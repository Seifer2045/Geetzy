"""xAI Grok: one chat call that returns JSON. Used ONLY by the admin's "Generate with Grok" (never per gift).

POST https://api.x.ai/v1/chat/completions, header `Authorization: Bearer <XAI_API_KEY>`, OpenAI-style body.
Endpoint, model name and `response_format` support are written from memory — verify on the first real call.
"""
import httpx

from ..config import get_settings

API = "https://api.x.ai/v1/chat/completions"
TIMEOUT_SEC = 120
MAX_TOKENS = 3_000
EST_COST_USD = 0.02  # rough, shown on the admin cost dashboard only


class XaiError(RuntimeError):
    pass


def chat_json(system: str, messages: list[dict[str, str]]) -> str:
    """Returns the assistant's text (JSON mode). `messages` = user/assistant turns after the system prompt."""
    s = get_settings()
    if not s.xai_api_key:
        raise XaiError("XAI_API_KEY is not set on the backend")
    res = httpx.post(
        API,
        headers={"Authorization": f"Bearer {s.xai_api_key}", "Content-Type": "application/json"},
        json={
            "model": s.xai_model,
            "messages": [{"role": "system", "content": system}, *messages],
            "temperature": 0.3,
            "max_tokens": MAX_TOKENS,
            "response_format": {"type": "json_object"},
        },
        timeout=TIMEOUT_SEC,
    )
    if res.status_code >= 400:
        raise XaiError(f"Grok failed ({res.status_code}): {res.text[:300]}")
    try:
        text = res.json()["choices"][0]["message"]["content"]
    except (ValueError, KeyError, IndexError, TypeError) as e:
        raise XaiError(f"Grok: unexpected reply: {res.text[:200]}") from e
    if not isinstance(text, str) or not text.strip():
        raise XaiError("Grok: empty reply")
    return text
