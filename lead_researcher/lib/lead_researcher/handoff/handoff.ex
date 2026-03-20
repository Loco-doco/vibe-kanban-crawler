defmodule LeadResearcher.Handoff do
  @moduledoc """
  Handoff state machine: approval → master_review_queue → duplicate check
  → ready_to_sync / conflict_queue.

  NO auto-sync to "synced" — that is a separate manual action.
  """

  import Ecto.Query
  alias LeadResearcher.Repo
  alias LeadResearcher.Leads.Lead

  @doc """
  Approve leads and queue them for master review.
  Sets review_status = "approved", master_sync_status = "master_review_queue",
  then runs duplicate check and transitions to ready_to_sync or conflict_queue.

  Returns {:ok, %{ready: count, conflicts: count, conflict_leads: [...]}}
  """
  def approve_and_queue(lead_ids) when is_list(lead_ids) do
    now = DateTime.utc_now() |> DateTime.truncate(:second)

    # Step 1: Set review_status = approved, master_sync_status = master_review_queue
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

    # Step 3: Load comparison pool (already synced or ready_to_sync leads)
    comparison_leads =
      from(l in Lead,
        where: l.master_sync_status in ["synced", "ready_to_sync"],
        where: l.id not in ^lead_ids
      )
      |> Repo.all()

    # Step 4: Check each queued lead for duplicates
    {ready_count, conflict_count, conflict_leads} =
      Enum.reduce(queued_leads, {0, 0, []}, fn lead, {r, c, cl} ->
        case check_duplicates(lead, comparison_leads) do
          [] ->
            # No conflict → ready_to_sync
            lead
            |> Ecto.Changeset.change(%{master_sync_status: "ready_to_sync"})
            |> Repo.update!()

            {r + 1, c, cl}

          conflicts ->
            # Conflict found → conflict_queue with details
            details = Jason.encode!(conflicts)

            lead
            |> Ecto.Changeset.change(%{
              master_sync_status: "conflict_queue",
              conflict_details: details
            })
            |> Repo.update!()

            {r, c + 1, [%{lead_id: lead.id, conflicts: conflicts} | cl]}
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
  """
  def check_duplicates(%Lead{} = lead, comparison_leads) do
    Enum.flat_map(comparison_leads, fn existing ->
      matches = []

      # Rule 1: channel_url exact match
      matches =
        if non_empty?(lead.channel_url) and non_empty?(existing.channel_url) and
             lead.channel_url == existing.channel_url do
          [%{rule: "channel_url", existing_lead_id: existing.id, value: lead.channel_url} | matches]
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
            [%{rule: "handle", existing_lead_id: existing.id, value: "@#{h1}"} | matches]
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
          [%{rule: "contact_email", existing_lead_id: existing.id, value: email_lead} | matches]
        else
          matches
        end

      # Rule 4: platform + channel_name similarity
      matches =
        if lead.platform == existing.platform and
             non_empty?(lead.channel_name) and non_empty?(existing.channel_name) and
             name_similar?(lead.channel_name, existing.channel_name) do
          [
            %{
              rule: "platform_name",
              existing_lead_id: existing.id,
              value: "#{lead.platform}:#{lead.channel_name} ≈ #{existing.channel_name}"
            }
            | matches
          ]
        else
          matches
        end

      matches
    end)
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
      # YouTube: youtube.com/@handle or youtube.com/c/handle or youtube.com/channel/ID
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
