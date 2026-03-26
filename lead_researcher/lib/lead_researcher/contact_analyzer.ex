defmodule LeadResearcher.ContactAnalyzer do
  @moduledoc """
  Classifies lead email addresses into contact readiness states.
  Returns {status, suspect_reason} tuple.

  States:
    - "contactable"       — valid email, no suspect patterns
    - "no_email"          — email is nil or empty
    - "platform_suspect"  — matches platform/generic email heuristic
    - "needs_verification" — email exists but doesn't meet contactable conditions
    - "user_confirmed"    — set manually when user provides contact_email
  """

  # Generic/shared mailbox prefixes — these indicate a shared/operations email
  # regardless of domain (free or custom)
  @suspect_prefixes ~w(
    support cs help admin info contact noreply no-reply
    service sales marketing hello team general enquiry
    inquiry office official biz partnership manager operations
  )

  # Platform-specific domains — emails @these domains are always suspect
  # because they are platform-generated, not personal addresses.
  # NOTE: free email providers (gmail, naver, daum, kakao) are NOT here.
  # Personal emails like pjw8425@naver.com should NOT be flagged.
  @platform_domains ~w(
    youtube.com instagram.com facebook.com twitter.com
    fanding.kr class101.net liveklass.com
    tiktok.com discord.com twitch.tv
  )

  @generic_footers ~w(webmaster postmaster abuse mailer-daemon root)

  @doc """
  Classify an email into a contact readiness status.
  Returns {status, suspect_reason} where suspect_reason is nil unless status is "platform_suspect".

  Classification priority:
  1. Generic mailbox prefix (support@, admin@, etc.) → platform_suspect (any domain)
  2. Platform-specific domain (youtube.com, instagram.com, etc.) → platform_suspect
  3. Generic footer local-part (webmaster, postmaster, etc.) → platform_suspect
  4. Otherwise → contactable
  """
  def classify(nil, _channel_name), do: {"no_email", nil}
  def classify("", _channel_name), do: {"no_email", nil}

  def classify(email, _channel_name) when is_binary(email) do
    case split_email(email) do
      {local, domain} ->
        cond do
          reason = suspect_prefix_reason(local) -> {"platform_suspect", reason}
          reason = generic_footer_reason(local) -> {"platform_suspect", reason}
          reason = platform_domain_reason(domain) -> {"platform_suspect", reason}
          true -> {"contactable", nil}
        end

      nil ->
        {"needs_verification", nil}
    end
  end

  # -- Private --

  defp split_email(email) do
    case String.split(email, "@") do
      [local, domain] when local != "" and domain != "" -> {local, domain}
      _ -> nil
    end
  end

  defp suspect_prefix_reason(local) do
    normalized = String.downcase(local)

    match =
      Enum.find(@suspect_prefixes, fn prefix ->
        String.starts_with?(normalized, prefix)
      end)

    if match, do: "prefix_#{match}", else: nil
  end

  defp platform_domain_reason(domain) do
    normalized = String.downcase(domain)

    match =
      Enum.find(@platform_domains, fn pd ->
        String.ends_with?(normalized, pd)
      end)

    if match do
      # Normalize domain name for reason (remove dots)
      domain_key = String.replace(match, ".", "_")
      "platform_domain_#{domain_key}"
    else
      nil
    end
  end

  defp generic_footer_reason(local) do
    normalized = String.downcase(local)

    if normalized in @generic_footers do
      "generic_footer_#{normalized}"
    else
      nil
    end
  end
end
