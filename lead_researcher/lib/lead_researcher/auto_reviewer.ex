defmodule LeadResearcher.AutoReviewer do
  @moduledoc """
  Automatic lead review classification.
  Reduces manual review burden by auto-approving/rejecting clear-cut cases,
  sending ambiguous cases to an exception queue.
  """

  alias LeadResearcher.Leads.Lead

  @doc """
  Classify a lead into auto_approved / auto_rejected / needs_review.
  Accepts either a Lead struct or a map of attrs (for pre-insert classification).
  """
  def classify(%Lead{} = lead) do
    classify_attrs(%{
      contact_readiness: lead.contact_readiness,
      email_status: lead.email_status,
      channel_name: lead.channel_name,
      subscriber_count: lead.subscriber_count,
      audience_size_override: lead.audience_size_override
    })
  end

  def classify(attrs) when is_map(attrs) do
    classify_attrs(attrs)
  end

  defp classify_attrs(attrs) do
    contact_readiness = get_field(attrs, :contact_readiness)
    email_status = get_field(attrs, :email_status)

    cond do
      # Auto-approve: contactable + valid email + has minimum profile
      contact_readiness == "contactable" and
        email_status in ["valid_syntax", "user_corrected"] and
        has_minimum_profile?(attrs) ->
        "auto_approved"

      # Auto-reject: no email + no audience data
      contact_readiness == "no_email" and
        no_audience_data?(attrs) ->
        "auto_rejected"

      # Auto-reject: invalid email syntax
      email_status == "invalid_syntax" ->
        "auto_rejected"

      # Everything else goes to exception queue
      true ->
        "needs_review"
    end
  end

  defp has_minimum_profile?(attrs) do
    has_name = not is_nil_or_empty?(get_field(attrs, :channel_name))
    has_audience = not is_nil(get_field(attrs, :subscriber_count)) or
                   not is_nil(get_field(attrs, :audience_size_override))
    has_name and has_audience
  end

  defp no_audience_data?(attrs) do
    is_nil(get_field(attrs, :subscriber_count)) and
      is_nil(get_field(attrs, :audience_size_override))
  end

  defp get_field(attrs, key) when is_atom(key) do
    Map.get(attrs, key) || Map.get(attrs, to_string(key))
  end

  defp is_nil_or_empty?(nil), do: true
  defp is_nil_or_empty?(""), do: true
  defp is_nil_or_empty?(_), do: false
end
