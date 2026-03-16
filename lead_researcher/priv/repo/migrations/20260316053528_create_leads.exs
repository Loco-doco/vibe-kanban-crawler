defmodule LeadResearcher.Repo.Migrations.CreateLeads do
  use Ecto.Migration

  def change do
    create table(:leads) do
      add :email, :string
      add :platform, :string
      add :channel_name, :string
      add :channel_url, :string
      add :evidence_link, :string, null: false
      add :confidence_score, :float, default: 0.0
      add :subscriber_count, :integer
      add :status, :string, default: "scraped", null: false
      add :last_contacted_at, :utc_datetime
      add :notes, :text
      add :raw_data, :text
      add :job_id, references(:jobs, on_delete: :delete_all), null: false

      timestamps()
    end

    create index(:leads, [:email])
    create index(:leads, [:channel_url])
    create index(:leads, [:job_id])
    create index(:leads, [:status])
  end
end
