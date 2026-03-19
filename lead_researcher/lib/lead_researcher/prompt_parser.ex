defmodule LeadResearcher.PromptParser do
  @moduledoc """
  Parses natural language prompts into structured search parameters
  using a rule-based Python subprocess. No external AI API required.
  """
  require Logger

  @crawler_dir Path.expand("../../../crawler", __DIR__)
  @timeout 30_000

  def parse(prompt) when is_binary(prompt) and byte_size(prompt) > 0 do
    config = Jason.encode!(%{"prompt" => prompt})
    python = System.find_executable("python3") || "python3"
    script = Path.join(@crawler_dir, "prompt_parser.py")

    port =
      Port.open(
        {:spawn_executable, python},
        [:binary, :exit_status, :use_stdio, :stderr_to_stdout, args: ["-u", script]]
      )

    Port.command(port, config <> "\n")
    read_result(port, "")
  end

  def parse(_), do: {:error, "프롬프트가 비어있습니다"}

  defp read_result(port, buffer) do
    receive do
      {^port, {:data, data}} ->
        read_result(port, buffer <> data)

      {^port, {:exit_status, 0}} ->
        parse_output(buffer)

      {^port, {:exit_status, code}} ->
        Logger.error("[PromptParser] Python process exited with code #{code}: #{buffer}")
        {:error, "파싱 실패 (exit code: #{code})"}
    after
      @timeout ->
        Port.close(port)
        Logger.error("[PromptParser] Timeout after #{@timeout}ms")
        {:error, "파싱 시간 초과"}
    end
  end

  defp parse_output(buffer) do
    line =
      buffer
      |> String.split("\n")
      |> Enum.map(&String.trim/1)
      |> Enum.reject(&(&1 == ""))
      |> List.last()

    case Jason.decode(line || "") do
      {:ok, %{"error" => error}} ->
        {:error, error}

      {:ok, %{"keywords" => keywords, "parse_mode" => mode} = result}
      when is_list(keywords) and length(keywords) > 0 ->
        Logger.info("[PromptParser] parse_mode=#{mode}, keywords=#{inspect(keywords)}")
        {:ok, result}

      {:ok, %{"keywords" => keywords} = result}
      when is_list(keywords) and length(keywords) > 0 ->
        {:ok, result}

      {:ok, _} ->
        {:error, "키워드를 추출할 수 없습니다"}

      {:error, _} ->
        Logger.error("[PromptParser] Failed to parse output: #{buffer}")
        {:error, "파싱 실패"}
    end
  end
end
