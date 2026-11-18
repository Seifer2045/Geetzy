import os

# Fake settings so tests never touch real services or the local .env.
os.environ.update(
    SUPABASE_URL="https://example.supabase.co",
    SUPABASE_SECRET_KEY="sb_secret_test",
    GEMINI_API_KEY="test-gemini",
    JSON2VIDEO_API_KEY="test-j2v",
    INTERNAL_SECRET="internal-test",
    WEBHOOK_SECRET="webhook-test",
    PUBLIC_BASE_URL="https://api.example.com",
    ALLOW_FAKE_PAYMENTS="true",
)
