import re

EMAIL_REGEX = re.compile(
    r"^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@"
    r"[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?"
    r"(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$"
)

DUMMY_EMAILS = {
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
    "abc@abc.com",
}

DUMMY_PATTERNS = [
    re.compile(r"^test\d*@", re.IGNORECASE),
    re.compile(r"^example\d*@", re.IGNORECASE),
    re.compile(r"^dummy\d*@", re.IGNORECASE),
    re.compile(r"^fake\d*@", re.IGNORECASE),
    re.compile(r"^noreply@", re.IGNORECASE),
    re.compile(r"^no-reply@", re.IGNORECASE),
    re.compile(r"@example\.(com|org|net)$", re.IGNORECASE),
    re.compile(r"@test\.(com|org|net)$", re.IGNORECASE),
    re.compile(r"@localhost$", re.IGNORECASE),
    # YouTube/Google platform emails (appear on all pages, not creator emails)
    re.compile(r"@google\.com$", re.IGNORECASE),
    re.compile(r"@youtube\.com$", re.IGNORECASE),
    re.compile(r"@googlemail\.com$", re.IGNORECASE),
]

IMAGE_EXTENSIONS = (".png", ".jpg", ".jpeg", ".gif", ".svg", ".webp", ".ico")


def is_valid_email(email):
    """Returns True if email passes all QA checks."""
    if not email:
        return False

    email = email.strip().lower()

    if not EMAIL_REGEX.match(email):
        return False

    if email in DUMMY_EMAILS:
        return False

    if any(p.search(email) for p in DUMMY_PATTERNS):
        return False

    # Filter image file extensions masquerading as emails
    domain = email.split("@")[1] if "@" in email else ""
    if any(domain.endswith(ext) for ext in IMAGE_EXTENSIONS):
        return False

    # Require at least one dot in domain (valid TLD)
    if "." not in domain:
        return False

    # Filter likely false positives from JSON parsing (e.g., "nbeautyclouduna@gmail.com")
    # These occur when email regex matches across JSON key boundaries
    local_part = email.split("@")[0]
    if len(local_part) > 40:
        return False

    return True
