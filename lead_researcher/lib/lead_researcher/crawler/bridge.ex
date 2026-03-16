defmodule LeadResearcher.Crawler.Bridge do
  require Logger

  @crawler_dir Path.expand("../../../../crawler", __DIR__)
  @timeout 300_000

  def run(config) when is_map(config) do
    config_json = Jason.encode!(config)
    python = System.find_executable("python3") || "python3"
    script = Path.join(@crawler_dir, "main.py")

    port =
      Port.open(
        {:spawn_executable, python},
        [
          :binary,
          :exit_status,
          :use_stdio,
          :stderr_to_stdout,
          args: ["-u", script]
        ]
      )

    Port.command(port, config_json <> "\n")
    collect_results(port, "", [])
  end

  defp collect_results(port, buffer, results) do
    receive do
      {^port, {:data, data}} ->
        buffer = buffer <> data
        {lines, remaining} = split_lines(buffer)

        new_results =
          Enum.reduce(lines, results, fn line, acc ->
            case parse_line(line) do
              {:lead, lead} -> [lead | acc]
              :skip -> acc
            end
          end)

        collect_results(port, remaining, new_results)

      {^port, {:exit_status, 0}} ->
        {lines, _} = split_lines(buffer)

        final =
          Enum.reduce(lines, results, fn line, acc ->
            case parse_line(line) do
              {:lead, lead} -> [lead | acc]
              :skip -> acc
            end
          end)

        Enum.reverse(final)

      {^port, {:exit_status, code}} ->
        Logger.error("Python crawler exited with code #{code}. Buffer: #{buffer}")
        {:error, "Crawler exited with code #{code}"}
    after
      @timeout ->
        Port.close(port)
        Logger.error("Crawler timed out after #{@timeout}ms")
        {:error, :timeout}
    end
  end

  defp split_lines(buffer) do
    case String.split(buffer, "\n") do
      [single] ->
        {[], single}

      parts ->
        {complete, [remaining]} = Enum.split(parts, -1)
        {Enum.reject(complete, &(&1 == "")), remaining}
    end
  end

  defp parse_line(line) do
    case Jason.decode(line) do
      {:ok, %{"type" => "lead"} = data} ->
        {:lead, data}

      {:ok, %{"type" => "log", "message" => msg}} ->
        Logger.info("[Crawler] #{msg}")
        :skip

      {:ok, %{"type" => "error", "message" => msg}} ->
        Logger.warning("[Crawler Error] #{msg}")
        :skip

      {:error, _} ->
        Logger.debug("[Crawler Raw] #{line}")
        :skip
    end
  end
end
