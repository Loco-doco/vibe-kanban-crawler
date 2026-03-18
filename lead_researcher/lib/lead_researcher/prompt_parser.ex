defmodule LeadResearcher.PromptParser do
  @moduledoc """
  Parses natural language prompts into structured search parameters
  using Claude API via a Python subprocess.
  """
  require Logger

  @crawler_dir Path.expand("../../../crawler", __DIR__)
  @timeout 30_000

  def parse(prompt) when is_binary(prompt) and byte_size(prompt) > 0 do
    api_key = resolve_api_key()
    config = Jason.encode!(%{"prompt" => prompt, "api_key" => api_key})
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
        Logger.error("Prompt parser exited with code #{code}: #{buffer}")
        {:error, "파싱 실패 (exit code: #{code})"}
    after
      @timeout ->
        Port.close(port)
        {:error, "파싱 시간 초과"}
    end
  end

  defp resolve_api_key do
    # 1. Environment variable (highest priority)
    case System.get_env("ANTHROPIC_API_KEY") do
      key when is_binary(key) and key != "" ->
        key

      _ ->
        # 2. macOS Keychain: Claude Code OAuth token (local development)
        read_keychain_token()
    end
  end

  defp read_keychain_token do
    case System.cmd(
           "security",
           ["find-generic-password", "-s", "Claude Code-credentials", "-w"],
           stderr_to_stdout: true
         ) do
      {json, 0} ->
        case Jason.decode(String.trim(json)) do
          {:ok, %{"claudeAiOauth" => %{"accessToken" => token}}}
          when is_binary(token) and token != "" ->
            token

          _ ->
            ""
        end

      _ ->
        ""
    end
  end

  defp parse_output(buffer) do
    # Take the last non-empty line (skip any warnings/stderr)
    line =
      buffer
      |> String.split("\n")
      |> Enum.map(&String.trim/1)
      |> Enum.reject(&(&1 == ""))
      |> List.last()

    case Jason.decode(line || "") do
      {:ok, %{"error" => error}} ->
        {:error, error}

      {:ok, %{"keywords" => keywords} = result} when is_list(keywords) and length(keywords) > 0 ->
        {:ok, result}

      {:ok, _} ->
        {:error, "키워드를 추출할 수 없습니다"}

      {:error, _} ->
        Logger.error("Failed to parse prompt parser output: #{buffer}")
        {:error, "AI 응답 파싱 실패"}
    end
  end
end
