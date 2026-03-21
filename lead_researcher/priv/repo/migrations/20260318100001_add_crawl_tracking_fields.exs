defmodule LeadResearcher.Repo.Migrations.AddCrawlTrackingFields do
  use Ecto.Migration

  def change do
    # Job: termination reason and crawl statistics
    alter table(:jobs) do
      add :termination_reason, :string
      add :crawl_stats, :text
    end

    # Lead: source metadata for tracking where leads were discovered
    alter table(:leads) do
      add :source_platform, :string
      add :source_type, :string
      add :source_url, :string
      add :discovery_keyword, :string
    end
  end
end
