defmodule LeadResearcher.Handoff do
  @moduledoc """
  Handoff state machine: approval → master_review_queue → duplicate check
  → ready_to_sync / conflict_queue.

  NO auto-sync to "synced" — that is a separate manual action.

  ## 비교 풀 정책
  중복 검사 대상 = synced + ready_to_sync + conflict_queue 상태의 리드.
  - synced: 이미 마스터에 반영된 리드
  - ready_to_sync: 충돌 없이 반영 대기 중인 리드
  - conflict_queue: 충돌이 감지되어 해결 대기 중인 리드 (파이프라인에 있으므로 포함)
  - master_review_queue: 내부 처리용 순간 상태 (함수 내에서 즉시 전환, UI에 노출 안 함)

  ## 배치 내부 중복
  같은 approve_and_queue 호출에 포함된 lead_ids끼리도 서로 비교함.
  처리된 리드가 ready_to_sync로 전환되면 다음 리드의 비교 풀에 추가됨.
  """

  import Ecto.Query
  alias LeadResearcher.Repo
  alias LeadResearcher.Leads.Lead
  alias LeadResearcher.MasterList.MasterListEntry

  @comparison_statuses ["synced", "ready_to_sync", "conflict_queue"]

  @rule_labels %{
    "channel_url" => "동일한 채널 URL",
    "handle" => "동일한 핸들(@)",
    "contact_email" => "동일한 이메일",
    "platform_name" => "동일 플랫폼 유사 채널명"
  }

  @doc """
  Approve leads and queue them for master review.
  Sets review_status = "approved", master_sync_status = "master_review_queue",
  then runs duplicate check and transitions to ready_to_sync or conflict_queue.

  Comparison pool: existing synced/ready_to_sync/conflict_queue leads
  + previously processed leads within this batch (배치 내부 중복 검사).

  Returns {:ok, %{ready: count, conflicts: count, conflict_leads: [...]}}
  """
  def approve_and_queue(lead_ids) when is_list(lead_ids) do
    now = DateTime.utc_now() |> DateTime.truncate(:second)

    # Step 1: Set review_status = approved, master_sync_status = master_review_queue
    # (master_review_queue is a transient internal state — never persists after this function)
    from(l in Lead, where: l.id in ^lead_ids)
    |> Repo.update_all(
      set: [
        review_status: "approved",
        master_sync_status: "master_review_queue",
        conflict_details: nil,
        updated_at: now
      ]
    )

    # Step 2: Load the leads we just queued
    queued_leads = from(l in Lead, where: l.id in ^lead_ids) |> Repo.all()

    # Step 3: Load external comparison pool (synced + ready_to_sync + conflict_queue)
    external_pool =
      from(l in Lead,
        where: l.master_sync_status in ^@comparison_statuses,
        where: l.id not in ^lead_ids
      )
      |> Repo.all()

    # Step 4: Check each queued lead for duplicates.
    # Accumulate processed leads into comparison pool for batch-internal duplicate detection.
    {ready_count, conflict_count, conflict_leads, _final_pool} =
      Enum.reduce(queued_leads, {0, 0, [], external_pool}, fn lead, {r, c, cl, pool} ->
        case check_duplicates(lead, pool) do
          [] ->
            # No conflict → ready_to_sync, add to pool for next iterations
            lead
            |> Ecto.Changeset.change(%{master_sync_status: "ready_to_sync"})
            |> Repo.update!()

            {r + 1, c, cl, [lead | pool]}

          conflicts ->
            # Conflict found → conflict_queue with details (including labels)
            details = Jason.encode!(conflicts)

            lead
            |> Ecto.Changeset.change(%{
              master_sync_status: "conflict_queue",
              conflict_details: details
            })
            |> Repo.update!()

            # conflict_queue leads also enter the pool for subsequent checks
            {r, c + 1, [%{lead_id: lead.id, conflicts: conflicts} | cl], [lead | pool]}
        end
      end)

    {:ok,
     %{
       ready: ready_count,
       conflicts: conflict_count,
       conflict_leads: Enum.reverse(conflict_leads)
     }}
  end

  @doc """
  Check a single lead against comparison pool using 4 duplicate rules.
  Returns list of conflict descriptors (empty = no conflict).

  Each descriptor contains:
  - rule: matching rule name
  - existing_lead_id: ID of the conflicting lead
  - value: the matched value
  - reason_label: human-readable Korean label
  """
  def check_duplicates(%Lead{} = lead, comparison_leads) do
    Enum.flat_map(comparison_leads, fn existing ->
      matches = []

      # Rule 1: channel_url exact match
      matches =
        if non_empty?(lead.channel_url) and non_empty?(existing.channel_url) and
             lead.channel_url == existing.channel_url do
          [%{rule: "channel_url", existing_lead_id: existing.id, value: lead.channel_url,
             reason_label: @rule_labels["channel_url"]} | matches]
        else
          matches
        end

      # Rule 2: normalized handle exact match
      matches =
        with h1 when h1 != nil <- extract_handle(lead.channel_url),
             h2 when h2 != nil <- extract_handle(existing.channel_url),
             true <- h1 == h2 do
          # Only add if not already caught by channel_url rule
          if Enum.any?(matches, &(&1.rule == "channel_url")) do
            matches
          else
            [%{rule: "handle", existing_lead_id: existing.id, value: "@#{h1}",
               reason_label: @rule_labels["handle"]} | matches]
          end
        else
          _ -> matches
        end

      # Rule 3: contact_email exact match (lowercase)
      email_lead = effective_email(lead)
      email_existing = effective_email(existing)

      matches =
        if non_empty?(email_lead) and non_empty?(email_existing) and
             String.downcase(email_lead) == String.downcase(email_existing) do
          [%{rule: "contact_email", existing_lead_id: existing.id, value: email_lead,
             reason_label: @rule_labels["contact_email"]} | matches]
        else
          matches
        end

      # Rule 4: platform + channel_name similarity (Jaro ≥ 0.8)
      matches =
        if lead.platform == existing.platform and
             non_empty?(lead.channel_name) and non_empty?(existing.channel_name) and
             name_similar?(lead.channel_name, existing.channel_name) do
          score = String.jaro_distance(normalize_name(lead.channel_name), normalize_name(existing.channel_name))

          [
            %{
              rule: "platform_name",
              existing_lead_id: existing.id,
              value: "#{lead.platform}:#{lead.channel_name} ≈ #{existing.channel_name}",
              reason_label: @rule_labels["platform_name"],
              similarity_score: Float.round(score, 2)
            }
            | matches
          ]
        else
          matches
        end

      matches
    end)
  end

  @doc """
  Resolve a conflict for a single lead.

  - "keep": Operator confirms this is NOT a duplicate → move to ready_to_sync
  - "reject": Operator confirms this IS a duplicate → reject and remove from pipeline
  """
  def resolve_conflict(lead_id, "keep") do
    lead = Repo.get!(Lead, lead_id)

    lead
    |> Ecto.Changeset.change(%{master_sync_status: "ready_to_sync", conflict_details: nil})
    |> Repo.update()
  end

  def resolve_conflict(lead_id, "reject") do
    lead = Repo.get!(Lead, lead_id)

    lead
    |> Ecto.Changeset.change(%{
      master_sync_status: "not_synced",
      review_status: "rejected",
      conflict_details: nil
    })
    |> Repo.update()
  end

  @doc """
  Bulk resolve conflicts: apply the same resolution to multiple leads.
  Returns {:ok, %{resolved: count}}
  """
  def bulk_resolve_conflicts(lead_ids, resolution) when resolution in ["keep", "reject"] do
    results = Enum.map(lead_ids, fn id -> resolve_conflict(id, resolution) end)
    resolved = Enum.count(results, &match?({:ok, _}, &1))
    {:ok, %{resolved: resolved}}
  end

  @doc """
  Final sync: move ready_to_sync leads to synced and create MasterListEntry records.
  Only leads currently in ready_to_sync are affected (WHERE guard).
  Returns {:ok, %{synced: count}}
  """
  def sync_to_master(lead_ids) when is_list(lead_ids) do
    now = DateTime.utc_now() |> DateTime.truncate(:second)

    # Fetch leads that will actually be synced (only ready_to_sync)
    leads_to_sync =
      from(l in Lead,
        where: l.id in ^lead_ids,
        where: l.master_sync_status == "ready_to_sync"
      )
      |> Repo.all()

    synced_ids = Enum.map(leads_to_sync, & &1.id)

    if synced_ids != [] do
      # Update master_sync_status to synced
      from(l in Lead, where: l.id in ^synced_ids)
      |> Repo.update_all(set: [master_sync_status: "synced", updated_at: now])

      # Create MasterListEntry for each synced lead (upsert: skip if already exists)
      Enum.each(leads_to_sync, fn lead ->
        %MasterListEntry{}
        |> MasterListEntry.changeset(%{lead_id: lead.id, job_id: lead.job_id})
        |> Repo.insert(on_conflict: :nothing, conflict_target: :lead_id)
      end)
    end

    {:ok, %{synced: length(synced_ids)}}
  end

  # --- Private helpers ---

  defp non_empty?(nil), do: false
  defp non_empty?(""), do: false
  defp non_empty?(_), do: true

  defp effective_email(lead) do
    lead.contact_email || lead.email
  end

  @doc false
  def extract_handle(nil), do: nil

  def extract_handle(url) when is_binary(url) do
    cond do
      # YouTube: youtube.com/@handle or youtube.com/c/handle
      match = Regex.run(~r{youtube\.com/@([^/?&]+)}i, url) ->
        match |> List.last() |> String.downcase()

      match = Regex.run(~r{youtube\.com/c/([^/?&]+)}i, url) ->
        match |> List.last() |> String.downcase()

      # Instagram: instagram.com/handle
      match = Regex.run(~r{instagram\.com/([^/?&]+)}i, url) ->
        handle = match |> List.last() |> String.downcase()
        if handle in ["p", "reel", "stories", "explore"], do: nil, else: handle

      true ->
        nil
    end
  end

  defp name_similar?(name1, name2) do
    n1 = normalize_name(name1)
    n2 = normalize_name(name2)

    cond do
      n1 == n2 -> true
      String.contains?(n1, n2) and String.length(n2) >= 3 -> true
      String.contains?(n2, n1) and String.length(n1) >= 3 -> true
      true -> jaro_similar?(n1, n2, 0.8)
    end
  end

  defp normalize_name(name) do
    name
    |> String.downcase()
    |> String.replace(~r/[\s_\-\.]+/, "")
    |> String.replace(~r/[^\w가-힣]/, "")
  end

  defp jaro_similar?(s1, s2, threshold) do
    String.jaro_distance(s1, s2) >= threshold
  end
end
