defmodule LeadResearcher.Jobs.JobQueue do
  use GenServer
  require Logger

  alias LeadResearcher.Jobs
  alias LeadResearcher.Crawler.Runner

  @poll_interval 5_000
  @max_concurrent 3

  def start_link(opts) do
    GenServer.start_link(__MODULE__, opts, name: __MODULE__)
  end

  def enqueue(job_id) do
    GenServer.cast(__MODULE__, {:enqueue, job_id})
  end

  def cancel(job_id) do
    GenServer.cast(__MODULE__, {:cancel, job_id})
  end

  @impl true
  def init(_opts) do
    state = %{
      running: %{},
      queue: :queue.new()
    }

    schedule_poll()
    {:ok, state}
  end

  @impl true
  def handle_cast({:enqueue, job_id}, state) do
    {:noreply, maybe_start_or_queue(job_id, state)}
  end

  @impl true
  def handle_cast({:cancel, job_id}, state) do
    case Map.get(state.running, job_id) do
      nil -> :ok
      %{pid: pid} -> Process.exit(pid, :shutdown)
    end

    Jobs.update_job_status(job_id, "cancelled")
    state = %{state | running: Map.delete(state.running, job_id)}
    {:noreply, drain_queue(state)}
  end

  @impl true
  def handle_info({ref, result}, state) when is_reference(ref) do
    {job_id, state} = pop_task_by_ref(ref, state)

    if job_id do
      case result do
        {:error, reason} ->
          Jobs.update_job_status(job_id, "failed", %{
            error_message: inspect(reason),
            completed_at: DateTime.utc_now()
          })
          Logger.error("Job #{job_id} failed: #{inspect(reason)}")

        _ ->
          Jobs.update_job_status(job_id, "completed", %{completed_at: DateTime.utc_now()})
          Logger.info("Job #{job_id} completed successfully")
      end
    end

    Process.demonitor(ref, [:flush])
    {:noreply, drain_queue(state)}
  end

  @impl true
  def handle_info({:DOWN, ref, :process, _pid, reason}, state) when reason != :normal do
    {job_id, state} = pop_task_by_ref(ref, state)

    if job_id do
      Jobs.update_job_status(job_id, "failed", %{error_message: inspect(reason)})
      Logger.error("Job #{job_id} failed: #{inspect(reason)}")
    end

    {:noreply, drain_queue(state)}
  end

  @impl true
  def handle_info({:DOWN, ref, :process, _pid, :normal}, state) do
    Process.demonitor(ref, [:flush])
    {:noreply, state}
  end

  @impl true
  def handle_info(:poll, state) do
    pending = Jobs.list_pending_job_ids()

    already_known =
      Map.keys(state.running) ++ :queue.to_list(state.queue)

    state =
      Enum.reduce(pending, state, fn id, acc ->
        if id in already_known, do: acc, else: maybe_start_or_queue(id, acc)
      end)

    schedule_poll()
    {:noreply, state}
  end

  @impl true
  def handle_info(_msg, state), do: {:noreply, state}

  defp maybe_start_or_queue(job_id, state) do
    if map_size(state.running) < @max_concurrent do
      start_task(job_id, state)
    else
      %{state | queue: :queue.in(job_id, state.queue)}
    end
  end

  defp start_task(job_id, state) do
    task =
      Task.Supervisor.async_nolink(LeadResearcher.TaskSupervisor, fn ->
        Runner.run(job_id)
      end)

    Jobs.update_job_status(job_id, "running", %{started_at: DateTime.utc_now()})
    Logger.info("Starting job #{job_id}")
    %{state | running: Map.put(state.running, job_id, %{ref: task.ref, pid: task.pid})}
  end

  defp drain_queue(state) do
    case :queue.out(state.queue) do
      {{:value, job_id}, rest} ->
        if map_size(state.running) < @max_concurrent do
          state = %{state | queue: rest}
          start_task(job_id, state)
        else
          state
        end

      {:empty, _} ->
        state
    end
  end

  defp pop_task_by_ref(ref, state) do
    case Enum.find(state.running, fn {_id, %{ref: r}} -> r == ref end) do
      {job_id, _} -> {job_id, %{state | running: Map.delete(state.running, job_id)}}
      nil -> {nil, state}
    end
  end

  defp schedule_poll do
    Process.send_after(self(), :poll, @poll_interval)
  end
end
