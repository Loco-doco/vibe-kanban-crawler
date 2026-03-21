defmodule LeadResearcher.Repo.Migrations.Phase5LeadProfileFields do
  use Ecto.Migration

  def change do
    alter table(:leads) do
      # Email status
      add :email_status, :string, default: "missing"

      # Audience metrics (raw stays in subscriber_count)
      add :audience_metric_type, :string, default: "unknown"
      add :audience_tier, :string
      add :audience_source, :string, default: "crawler"

      # User overrides (never overwrite raw fields)
      add :display_name, :string
      add :contact_email, :string
      add :audience_size_override, :integer
      add :audience_tier_override, :string

      # Enrichment tracking
      add :enrichment_status, :string, default: "not_started"
    end

    # Backfill email_status from existing data
    execute(
      "UPDATE leads SET email_status = 'valid_syntax' WHERE email IS NOT NULL AND email != ''",
      "SELECT 1"
    )

    # Backfill audience_metric_type from platform
    execute(
      "UPDATE leads SET audience_metric_type = 'subscriber' WHERE platform = 'youtube'",
      "SELECT 1"
    )

    execute(
      "UPDATE leads SET audience_metric_type = 'follower' WHERE platform = 'instagram'",
      "SELECT 1"
    )

    # Backfill audience_tier from subscriber_count
    execute(
      "UPDATE leads SET audience_tier = 'nano' WHERE subscriber_count IS NOT NULL AND subscriber_count < 1000",
      "SELECT 1"
    )

    execute(
      "UPDATE leads SET audience_tier = 'micro' WHERE subscriber_count IS NOT NULL AND subscriber_count >= 1000 AND subscriber_count < 10000",
      "SELECT 1"
    )

    execute(
      "UPDATE leads SET audience_tier = 'mid' WHERE subscriber_count IS NOT NULL AND subscriber_count >= 10000 AND subscriber_count < 100000",
      "SELECT 1"
    )

    execute(
      "UPDATE leads SET audience_tier = 'macro' WHERE subscriber_count IS NOT NULL AND subscriber_count >= 100000 AND subscriber_count < 1000000",
      "SELECT 1"
    )

    execute(
      "UPDATE leads SET audience_tier = 'mega' WHERE subscriber_count IS NOT NULL AND subscriber_count >= 1000000",
      "SELECT 1"
    )
  end
end
