defmodule LeadResearcher.Application do
  @moduledoc false

  use Application

  @impl true
  def start(_type, _args) do
    children = [
      LeadResearcherWeb.Telemetry,
      LeadResearcher.Repo,
      {Ecto.Migrator,
       repos: Application.fetch_env!(:lead_researcher, :ecto_repos), skip: skip_migrations?()},
      {DNSCluster, query: Application.get_env(:lead_researcher, :dns_cluster_query) || :ignore},
      {Phoenix.PubSub, name: LeadResearcher.PubSub},
      {Task.Supervisor, name: LeadResearcher.TaskSupervisor},
      LeadResearcher.Jobs.JobQueue,
      LeadResearcherWeb.Endpoint
    ]

    opts = [strategy: :one_for_one, name: LeadResearcher.Supervisor]
    Supervisor.start_link(children, opts)
  end

  @impl true
  def config_change(changed, _new, removed) do
    LeadResearcherWeb.Endpoint.config_change(changed, removed)
    :ok
  end

  defp skip_migrations?() do
    System.get_env("RELEASE_NAME") == nil
  end
end
