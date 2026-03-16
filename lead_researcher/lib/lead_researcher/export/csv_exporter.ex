defmodule LeadResearcher.Export.CsvExporter do
  @headers [
    "ID",
    "Email",
    "Platform",
    "Channel Name",
    "Channel URL",
    "Evidence Link",
    "Confidence Score",
    "Subscriber Count",
    "Status",
    "Last Contacted",
    "Created At"
  ]

  def to_csv(leads) do
    header_row = Enum.join(@headers, ",")

    data_rows =
      Enum.map(leads, fn lead ->
        [
          lead.id,
          escape(lead.email),
          escape(lead.platform),
          escape(lead.channel_name),
          escape(lead.channel_url),
          escape(lead.evidence_link),
          lead.confidence_score,
          lead.subscriber_count || "",
          escape(lead.status),
          lead.last_contacted_at || "",
          lead.inserted_at
        ]
        |> Enum.join(",")
      end)

    Enum.join([header_row | data_rows], "\n")
  end

  defp escape(nil), do: ""

  defp escape(value) when is_binary(value) do
    if String.contains?(value, [",", "\"", "\n"]) do
      "\"" <> String.replace(value, "\"", "\"\"") <> "\""
    else
      value
    end
  end

  defp escape(value), do: to_string(value)
end
