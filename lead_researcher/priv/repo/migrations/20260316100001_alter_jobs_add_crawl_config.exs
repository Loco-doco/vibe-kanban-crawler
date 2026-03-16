defmodule LeadResearcher.Repo.Migrations.AlterJobsAddCrawlConfig do
  use Ecto.Migration

  def change do
    alter table(:jobs) do
      add :platform, :string
      add :category_tags, :text
      add :target_count, :integer, default: 50
      add :subscriber_min, :integer
      add :subscriber_max, :integer
      add :extra_conditions, :text
      add :label, :string
    end
  end
end
