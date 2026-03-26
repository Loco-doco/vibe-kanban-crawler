defmodule LeadResearcher.Leads do
  import Ecto.Query
  alias LeadResearcher.Repo
  alias LeadResearcher.Leads.Lead
  alias LeadResearcher.EditHistories

  def list_leads(params \\ %{}) do
    Lead
    |> maybe_filter_job(params)
    |> maybe_filter_action_queue(params)
    |> maybe_filter_platform(params)
    |> maybe_filter_status(params)
    |> maybe_filter_min_confidence(params)
    |> maybe_filter_has_email(params)
    |> maybe_filter_email_status(params)
    |> maybe_filter_contact_readiness(params)
    |> maybe_filter_review_status(params)
    |> maybe_filter_enrichment_status(params)
    |> maybe_filter_audience_tier(params)
    |> maybe_search(params)
    |> apply_sort(params)
    |> limit(^parse_int(params, "limit", 50))
    |> offset(^parse_int(params, "offset", 0))
    |> Repo.all()
    |> Repo.preload(:enrichment)
  end

  def get_lead!(id) do
    Lead
    |> Repo.get!(id)
    |> Repo.preload(:enrichment)
  end

  def create_lead(attrs) do
    %Lead{}
    |> Lead.changeset(attrs)
    |> Repo.insert()
  end

  def update_lead(%Lead{} = lead, attrs) do
    lead
    |> Lead.changeset(attrs)
    |> Repo.update()
  end

  @doc """
  Update lead with edit history tracking.
  Only records changes for fields that actually changed.
  Auto-sets email_status to "user_corrected" when contact_email changes.
  """
  def update_lead_with_history(%Lead{} = lead, attrs, edited_by \\ "user") do
    # Detect actual changes
    changes =
      attrs
      |> Enum.filter(fn {field, new_val} ->
        old_val = Map.get(lead, field)
        to_string_or_nil(old_val) != to_string_or_nil(new_val)
      end)
      |> Enum.map(fn {field, new_val} ->
        {field, {Map.get(lead, field), new_val}}
      end)

    if changes == [] do
      {:ok, lead}
    else
      change_fields = Enum.map(changes, fn {field, _} -> field end)

      # Auto-set email_status + contact_readiness when contact_email actually changed
      auto_changes =
        if :contact_email in change_fields do
          old_email_status = lead.email_status
          old_readiness = lead.contact_readiness
          [
            {:email_status, {old_email_status, "user_corrected"}},
            {:contact_readiness, {old_readiness, "user_confirmed"}},
            {:suspect_reason, {lead.suspect_reason, nil}}
          ]
        else
          []
        end

      # Auto-compute audience_tier_override when audience_size_override changed
      auto_changes =
        if :audience_size_override in change_fields do
          {_, {_old_size, new_size}} = Enum.find(changes, fn {f, _} -> f == :audience_size_override end)
          new_tier = Lead.compute_audience_tier(new_size)
          old_tier = lead.audience_tier_override
          auto_changes ++ [{:audience_tier_override, {old_tier, new_tier}}]
        else
          auto_changes
        end

      # Build final attrs with auto-computed fields
      auto_attrs =
        Enum.reduce(auto_changes, attrs, fn {field, {_old, new}}, acc ->
          Map.put(acc, field, new)
        end)

      case update_lead(lead, auto_attrs) do
        {:ok, updated} ->
          # Log both user changes and auto-computed changes
          all_changes = changes ++ auto_changes
          EditHistories.log_changes(lead.id, all_changes, edited_by)

          # Recompute priority score if relevant fields changed
          priority_fields = [:contact_readiness, :audience_size_override, :audience_tier_override,
                             :enrichment_status, :subscriber_count, :audience_tier, :confidence_score]
          all_change_fields = Enum.map(all_changes, fn {f, _} -> f end)
          if Enum.any?(priority_fields, &(&1 in all_change_fields)) do
            LeadResearcher.Quality.Priority.recompute_for_lead(updated)
          end

          {:ok, Repo.preload(updated, :enrichment)}

        error ->
          error
      end
    end
  end

  @doc "List leads for a job that have a channel_url but no subscriber_count"
  def list_leads_missing_subscribers(job_id) do
    from(l in Lead,
      where: l.job_id == ^job_id,
      where: l.platform == "youtube",
      where: is_nil(l.subscriber_count),
      where: not is_nil(l.channel_url) and l.channel_url != "",
      select: %{id: l.id, channel_url: l.channel_url}
    )
    |> Repo.all()
  end

  @doc "List leads for a job that need enrichment (have channel_url, enrichment not yet done)"
  def list_leads_for_enrichment(job_id) do
    from(l in Lead,
      where: l.job_id == ^job_id,
      where: l.enrichment_status in ["not_started", "failed"],
      where: not is_nil(l.channel_url) and l.channel_url != "",
      select: %{id: l.id, channel_url: l.channel_url}
    )
    |> Repo.all()
  end

  @doc "Update subscriber_count and recalculate audience_tier for a lead"
  def backfill_subscriber_count(lead_id, subscriber_count) do
    lead = Repo.get!(Lead, lead_id)
    tier = Lead.compute_audience_tier(subscriber_count)

    case lead
         |> Lead.changeset(%{
           subscriber_count: subscriber_count,
           audience_tier: tier
         })
         |> Repo.update() do
      {:ok, updated} ->
        LeadResearcher.Quality.Priority.recompute_for_lead(updated)
        {:ok, updated}

      error ->
        error
    end
  end

  def set_audience_failure_reason(lead_id, reason) do
    lead = Repo.get!(Lead, lead_id)

    lead
    |> Lead.changeset(%{audience_failure_reason: reason})
    |> Repo.update()
  end

  @doc "Run auto-review classification on all pending leads for a job"
  def auto_review_job(job_id) do
    leads =
      from(l in Lead,
        where: l.job_id == ^job_id,
        where: l.review_status == "pending"
      )
      |> Repo.all()

    Enum.each(leads, fn lead ->
      new_status = LeadResearcher.AutoReviewer.classify(lead)
      if new_status != lead.review_status do
        lead
        |> Lead.changeset(%{review_status: new_status})
        |> Repo.update()
      end
    end)

    length(leads)
  end

  @doc "Bulk update review_status for multiple leads"
  def bulk_update_review(lead_ids, review_status) when is_list(lead_ids) do
    from(l in Lead, where: l.id in ^lead_ids)
    |> Repo.update_all(set: [review_status: review_status, updated_at: DateTime.utc_now() |> DateTime.truncate(:second)])
  end

  def merge_lead(%Lead{} = existing, new_attrs) do
    merged =
      %{}
      |> maybe_merge_field(existing, new_attrs, :email)
      |> maybe_merge_field(existing, new_attrs, :channel_name)
      |> maybe_merge_field(existing, new_attrs, :subscriber_count)
      |> Map.put(:confidence_score, max(existing.confidence_score, new_attrs[:confidence_score] || 0.0))

    # Also merge audience fields if new data available
    merged =
      merged
      |> maybe_merge_field(existing, new_attrs, :email_status)
      |> maybe_merge_field(existing, new_attrs, :audience_metric_type)
      |> maybe_merge_field(existing, new_attrs, :audience_tier)

    update_lead(existing, merged)
  end

  def find_by_email(nil), do: nil

  def find_by_email(email) do
    Repo.one(from l in Lead, where: l.email == ^email, limit: 1)
  end

  def find_by_channel_url(nil), do: nil

  def find_by_channel_url(url) do
    Repo.one(from l in Lead, where: l.channel_url == ^url, limit: 1)
  end

  def find_by_email_domain(domain) do
    pattern = "%@#{domain}"
    Repo.one(from l in Lead, where: like(l.email, ^pattern), limit: 1)
  end

  def delete_lead(%Lead{} = lead) do
    Repo.delete(lead)
  end

  # Private helpers

  defp maybe_merge_field(map, existing, new_attrs, field) do
    new_val = Map.get(new_attrs, field)
    old_val = Map.get(existing, field)

    if new_val && (is_nil(old_val) || old_val == "") do
      Map.put(map, field, new_val)
    else
      map
    end
  end

  defp maybe_filter_job(query, %{"job_id" => job_id}) do
    where(query, [l], l.job_id == ^parse_int_val(job_id))
  end

  defp maybe_filter_job(query, _), do: query

  defp maybe_filter_platform(query, %{"platform" => platform}) when is_binary(platform) do
    where(query, [l], l.platform == ^platform)
  end

  defp maybe_filter_platform(query, _), do: query

  defp maybe_filter_status(query, %{"status" => status}) when is_binary(status) do
    where(query, [l], l.status == ^status)
  end

  defp maybe_filter_status(query, _), do: query

  defp maybe_filter_email_status(query, %{"email_status" => es}) when is_binary(es) do
    where(query, [l], l.email_status == ^es)
  end

  defp maybe_filter_email_status(query, _), do: query

  defp maybe_filter_contact_readiness(query, %{"contact_readiness" => cr}) when is_binary(cr) do
    where(query, [l], l.contact_readiness == ^cr)
  end

  defp maybe_filter_contact_readiness(query, _), do: query

  defp maybe_filter_review_status(query, %{"review_status" => rs}) when is_binary(rs) do
    where(query, [l], l.review_status == ^rs)
  end

  defp maybe_filter_review_status(query, _), do: query

  defp maybe_filter_enrichment_status(query, %{"enrichment_status" => es}) when is_binary(es) do
    where(query, [l], l.enrichment_status == ^es)
  end

  defp maybe_filter_enrichment_status(query, _), do: query

  defp maybe_filter_audience_tier(query, %{"audience_tier" => tier}) when is_binary(tier) do
    where(query, [l], coalesce(l.audience_tier_override, l.audience_tier) == ^tier)
  end

  defp maybe_filter_audience_tier(query, _), do: query

  defp maybe_filter_min_confidence(query, %{"min_confidence" => min}) do
    min_val = parse_float(min)
    where(query, [l], l.confidence_score >= ^min_val)
  end

  defp maybe_filter_min_confidence(query, _), do: query

  defp maybe_filter_has_email(query, %{"has_email" => "true"}) do
    where(query, [l], not is_nil(l.email) and l.email != "")
  end

  defp maybe_filter_has_email(query, %{"has_email" => "false"}) do
    where(query, [l], is_nil(l.email) or l.email == "")
  end

  defp maybe_filter_has_email(query, _), do: query

  # Action queue: compound filters for CRM work queues (Phase 6)
  defp maybe_filter_action_queue(query, %{"action_queue" => "needs_verification"}) do
    where(query, [l], l.contact_readiness in ["platform_suspect", "needs_verification"])
  end

  defp maybe_filter_action_queue(query, %{"action_queue" => "contactable"}) do
    where(query, [l], l.contact_readiness in ["contactable", "user_confirmed"] and l.review_status not in ["rejected", "auto_rejected"])
  end

  defp maybe_filter_action_queue(query, %{"action_queue" => "needs_correction"}) do
    where(
      query,
      [l],
      l.contact_readiness not in ["contactable", "user_confirmed"] and
        l.review_status not in ["rejected", "auto_rejected"] and
        ((l.platform in ["youtube", "instagram"] and is_nil(l.subscriber_count) and is_nil(l.audience_size_override)) or
           l.enrichment_status in ["not_started", "failed"])
    )
  end

  defp maybe_filter_action_queue(query, %{"action_queue" => "held"}) do
    where(query, [l], l.review_status == "held")
  end

  defp maybe_filter_action_queue(query, %{"action_queue" => "excluded"}) do
    where(query, [l], l.review_status in ["auto_rejected", "rejected"])
  end

  # Master pipeline queues (B1+B2)
  defp maybe_filter_action_queue(query, %{"action_queue" => "conflict_queue"}) do
    where(query, [l], l.master_sync_status == "conflict_queue")
  end

  defp maybe_filter_action_queue(query, %{"action_queue" => "ready_to_sync"}) do
    where(query, [l], l.master_sync_status == "ready_to_sync")
  end

  defp maybe_filter_action_queue(query, %{"action_queue" => "synced"}) do
    where(query, [l], l.master_sync_status == "synced")
  end

  defp maybe_filter_action_queue(query, _), do: query

  defp maybe_search(query, %{"search" => search}) when is_binary(search) and search != "" do
    pattern = "%#{search}%"

    where(
      query,
      [l],
      like(l.email, ^pattern) or like(l.channel_name, ^pattern) or
        like(l.display_name, ^pattern) or like(l.contact_email, ^pattern)
    )
  end

  defp maybe_search(query, _), do: query

  defp apply_sort(query, %{"sort" => field, "order" => "asc"}) do
    order_by(query, [l], asc: ^safe_sort_field(field))
  end

  defp apply_sort(query, %{"sort" => field}) do
    order_by(query, [l], desc: ^safe_sort_field(field))
  end

  defp apply_sort(query, _), do: order_by(query, [l], [desc: :priority_score, desc: :inserted_at])

  defp safe_sort_field("priority_score"), do: :priority_score
  defp safe_sort_field("confidence_score"), do: :confidence_score
  defp safe_sort_field("subscriber_count"), do: :subscriber_count
  defp safe_sort_field("email"), do: :email
  defp safe_sort_field("platform"), do: :platform
  defp safe_sort_field("updated_at"), do: :updated_at
  defp safe_sort_field("inserted_at"), do: :inserted_at
  defp safe_sort_field("email_status"), do: :email_status
  defp safe_sort_field("audience_tier"), do: :audience_tier
  defp safe_sort_field("review_status"), do: :review_status
  defp safe_sort_field(_), do: :priority_score

  defp parse_int(params, key, default) do
    case Map.get(params, key) do
      nil -> default
      val when is_integer(val) -> val
      val when is_binary(val) -> String.to_integer(val)
    end
  rescue
    _ -> default
  end

  defp parse_int_val(val) when is_integer(val), do: val
  defp parse_int_val(val) when is_binary(val), do: String.to_integer(val)

  defp parse_float(val) when is_float(val), do: val
  defp parse_float(val) when is_integer(val), do: val / 1
  defp parse_float(val) when is_binary(val), do: String.to_float(val)
  defp parse_float(_), do: 0.0

  defp to_string_or_nil(nil), do: nil
  defp to_string_or_nil(val), do: to_string(val)
end
