defmodule LeadResearcherWeb.LeadJSON do
  alias LeadResearcher.Leads.Lead

  def index(%{leads: leads}), do: %{data: for(lead <- leads, do: data(lead))}
  def show(%{lead: lead}), do: %{data: data(lead)}

  defp data(%Lead{} = lead) do
    %{
      id: lead.id,
      email: lead.email,
      platform: lead.platform,
      channel_name: lead.channel_name,
      channel_url: lead.channel_url,
      evidence_link: lead.evidence_link,
      confidence_score: lead.confidence_score,
      subscriber_count: lead.subscriber_count,
      status: lead.status,
      last_contacted_at: lead.last_contacted_at,
      notes: lead.notes,
      job_id: lead.job_id,
      inserted_at: lead.inserted_at
    }
  end
end
