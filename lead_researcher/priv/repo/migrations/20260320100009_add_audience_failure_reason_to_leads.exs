defmodule LeadResearcher.Repo.Migrations.AddAudienceFailureReasonToLeads do
  use Ecto.Migration

  def change do
    alter table(:leads) do
      add :audience_failure_reason, :string
    end
  end
end
