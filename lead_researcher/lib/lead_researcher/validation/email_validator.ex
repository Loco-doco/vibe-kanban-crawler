defmodule LeadResearcher.Validation.EmailValidator do
  @email_regex ~r/^[a-zA-Z0-9.!#$%&'*+\/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/

  @dummy_emails MapSet.new([
    "test@test.com",
    "admin@admin.com",
    "user@example.com",
    "info@example.com",
    "noreply@example.com",
    "test@example.com",
    "email@example.com",
    "name@domain.com",
    "your@email.com",
    "contact@example.com",
    "hello@example.com",
    "demo@demo.com",
    "sample@sample.com",
    "mail@mail.com",
    "abc@abc.com"
  ])

  @dummy_patterns [
    ~r/^test\d*@/i,
    ~r/^example\d*@/i,
    ~r/^dummy\d*@/i,
    ~r/^fake\d*@/i,
    ~r/^noreply@/i,
    ~r/^no-reply@/i,
    ~r/@example\.(com|org|net)$/i,
    ~r/@test\.(com|org|net)$/i,
    ~r/@localhost$/i,
    ~r/@.*\.local$/i
  ]

  def valid?(email) when is_binary(email) do
    email = String.downcase(String.trim(email))

    Regex.match?(@email_regex, email) and
      not MapSet.member?(@dummy_emails, email) and
      not Enum.any?(@dummy_patterns, &Regex.match?(&1, email))
  end

  def valid?(_), do: false
end
