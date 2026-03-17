defmodule LeadResearcher.Repo.Migrations.AddDiscoveryModeToJobs do
  use Ecto.Migration

  def change do
    alter table(:jobs) do
      add :mode, :string, default: "url"
      add :keywords, :string
    end
  end
end
