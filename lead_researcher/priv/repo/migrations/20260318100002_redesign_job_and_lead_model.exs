defmodule LeadResearcher.Repo.Migrations.RedesignJobAndLeadModel do
  use Ecto.Migration

  def up do
    # 1. Jobs: rename "pending" → "queued"
    execute "UPDATE jobs SET status = 'queued' WHERE status = 'pending'"

    # 2. Leads: add review_status and master_sync_status
    alter table(:leads) do
      add :review_status, :string, default: "pending"
      add :master_sync_status, :string, default: "not_synced"
    end

    # 3. Backfill review_status for existing leads
    execute "UPDATE leads SET review_status = 'pending' WHERE review_status IS NULL"
    execute "UPDATE leads SET master_sync_status = 'not_synced' WHERE master_sync_status IS NULL"
  end

  def down do
    execute "UPDATE jobs SET status = 'pending' WHERE status = 'queued'"

    alter table(:leads) do
      remove :review_status
      remove :master_sync_status
    end
  end
end
