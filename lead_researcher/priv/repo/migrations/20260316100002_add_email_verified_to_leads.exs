defmodule LeadResearcher.Repo.Migrations.AddEmailVerifiedToLeads do
  use Ecto.Migration

  def change do
    alter table(:leads) do
      add :email_verified, :boolean, default: false
    end
  end
end
