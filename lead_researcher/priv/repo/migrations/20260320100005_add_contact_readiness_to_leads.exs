defmodule LeadResearcher.Repo.Migrations.AddContactReadinessToLeads do
  use Ecto.Migration

  def up do
    alter table(:leads) do
      add :contact_readiness, :string, default: "needs_verification"
      add :suspect_reason, :string
    end

    # Backfill existing leads
    execute """
    UPDATE leads SET contact_readiness = CASE
      WHEN contact_email IS NOT NULL AND contact_email != '' THEN 'user_confirmed'
      WHEN email IS NULL OR email = '' THEN 'no_email'
      WHEN email_status = 'invalid_syntax' THEN 'needs_verification'
      ELSE 'needs_verification'
    END
    """

    # Mark platform_suspect for known patterns
    # Suspect prefixes
    for prefix <- ~w(support cs help admin info contact noreply no-reply service sales marketing hello team general enquiry inquiry office) do
      execute """
      UPDATE leads SET contact_readiness = 'platform_suspect',
        suspect_reason = 'prefix_#{prefix}'
      WHERE email IS NOT NULL AND email != ''
        AND contact_readiness != 'user_confirmed'
        AND lower(substr(email, 1, instr(email, '@') - 1)) LIKE '#{prefix}%'
      """
    end

    # Platform domains
    for domain <- ~w(youtube.com google.com instagram.com facebook.com twitter.com fanding.kr class101.net liveklass.com naver.com daum.net kakao.com tiktok.com discord.com twitch.tv) do
      domain_key = String.replace(domain, ".", "_")
      execute """
      UPDATE leads SET contact_readiness = 'platform_suspect',
        suspect_reason = 'platform_domain_#{domain_key}'
      WHERE email IS NOT NULL AND email != ''
        AND contact_readiness != 'user_confirmed'
        AND lower(substr(email, instr(email, '@') + 1)) LIKE '%#{domain}'
      """
    end

    # Generic footers
    for footer <- ~w(webmaster postmaster abuse mailer-daemon root) do
      execute """
      UPDATE leads SET contact_readiness = 'platform_suspect',
        suspect_reason = 'generic_footer_#{footer}'
      WHERE email IS NOT NULL AND email != ''
        AND contact_readiness != 'user_confirmed'
        AND lower(substr(email, 1, instr(email, '@') - 1)) = '#{footer}'
      """
    end

    # Mark contactable for remaining valid emails that aren't suspect
    execute """
    UPDATE leads SET contact_readiness = 'contactable'
    WHERE email IS NOT NULL AND email != ''
      AND email_status IN ('valid_syntax', 'user_corrected')
      AND contact_readiness = 'needs_verification'
    """
  end

  def down do
    alter table(:leads) do
      remove :contact_readiness
      remove :suspect_reason
    end
  end
end
