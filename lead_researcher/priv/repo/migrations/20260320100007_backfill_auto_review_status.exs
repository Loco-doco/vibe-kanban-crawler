defmodule LeadResearcher.Repo.Migrations.BackfillAutoReviewStatus do
  use Ecto.Migration

  def change do
    # Auto-reject: invalid email syntax
    execute(
      "UPDATE leads SET review_status = 'auto_rejected' WHERE review_status = 'pending' AND email_status = 'invalid_syntax'",
      "UPDATE leads SET review_status = 'pending' WHERE review_status = 'auto_rejected'"
    )

    # Auto-reject: no email + no subscriber_count
    execute(
      "UPDATE leads SET review_status = 'auto_rejected' WHERE review_status = 'pending' AND contact_readiness = 'no_email' AND subscriber_count IS NULL AND audience_size_override IS NULL",
      "UPDATE leads SET review_status = 'pending' WHERE review_status = 'auto_rejected'"
    )

    # Auto-approve: contactable + valid email + has name + has audience
    execute(
      "UPDATE leads SET review_status = 'auto_approved' WHERE review_status = 'pending' AND contact_readiness = 'contactable' AND email_status IN ('valid_syntax', 'user_corrected') AND channel_name IS NOT NULL AND channel_name != '' AND (subscriber_count IS NOT NULL OR audience_size_override IS NOT NULL)",
      "UPDATE leads SET review_status = 'pending' WHERE review_status = 'auto_approved'"
    )

    # Remaining pending → needs_review
    execute(
      "UPDATE leads SET review_status = 'needs_review' WHERE review_status = 'pending'",
      "UPDATE leads SET review_status = 'pending' WHERE review_status = 'needs_review'"
    )
  end
end
