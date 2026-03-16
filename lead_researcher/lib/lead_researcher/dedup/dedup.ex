defmodule LeadResearcher.Dedup do
  alias LeadResearcher.Leads

  def check(%{email: email, channel_url: channel_url}) do
    check_email(email, channel_url) ||
      check_channel_url(channel_url, email) ||
      check_domain(email, channel_url) ||
      :new
  end

  def check(_), do: :new

  defp check_email(nil, _), do: nil

  defp check_email(email, channel_url) do
    case Leads.find_by_email(email) do
      nil ->
        nil

      existing ->
        if existing.channel_url == channel_url,
          do: :duplicate,
          else: {:merge, existing}
    end
  end

  defp check_channel_url(nil, _), do: nil

  defp check_channel_url(channel_url, email) do
    case Leads.find_by_channel_url(channel_url) do
      nil ->
        nil

      existing ->
        if existing.email == email,
          do: :duplicate,
          else: {:merge, existing}
    end
  end

  defp check_domain(nil, _), do: nil
  defp check_domain(_, nil), do: nil

  defp check_domain(email, channel_url) do
    email_domain = extract_email_domain(email)
    url_domain = extract_url_domain(channel_url)

    if email_domain && url_domain && String.contains?(url_domain, email_domain) do
      case Leads.find_by_email_domain(email_domain) do
        nil -> nil
        existing -> {:merge, existing}
      end
    end
  end

  defp extract_email_domain(email) do
    case String.split(email, "@") do
      [_, domain] -> domain
      _ -> nil
    end
  end

  defp extract_url_domain(url) do
    case URI.parse(url) do
      %URI{host: host} when is_binary(host) -> host
      _ -> nil
    end
  end
end
