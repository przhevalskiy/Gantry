# Per-Org LLM BYOK

Platform customers bring their own LLM provider keys. Inference bills go to **their** provider account, not yours.

---

## Setup (once per org)

### 1. Store the provider API key

```bash
curl -X POST http://localhost:8001/v1/secrets \
  -H "Authorization: Bearer $GANTRY_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"name": "anthropic-prod", "value": "sk-ant-..."}'
```

### 2. Set org LLM defaults

```bash
curl -X PATCH http://localhost:8001/v1/settings \
  -H "Authorization: Bearer $GANTRY_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "provider": "anthropic",
    "api_key_secret": "anthropic-prod",
    "sonnet_model": "claude-sonnet-4-6",
    "haiku_model": "claude-haiku-4-5-20251001"
  }'
```

### 3. Submit tasks — no inline key needed

```bash
curl -X POST http://localhost:8001/v1/tasks \
  -H "Authorization: Bearer $GANTRY_API_KEY" \
  -d '{"goal": "Add health check", "project_id": "..."}'
```

The worker uses the org's key for every agent in the pipeline. Keys are forwarded per-task to the worker and never returned in API responses.

---

## Supported providers

| Provider | `provider` value | Example models |
|---|---|---|
| **Anthropic** | `anthropic` | `claude-sonnet-4-6`, `claude-haiku-4-5-20251001` |
| **Mistral** | `mistral` | `mistral-large-latest`, `mistral-small-latest` |
| **OpenAI-compatible** | `openai` | `gpt-4o`, `gpt-4o-mini`, or any model on Ollama/vLLM |

### Ollama / vLLM / local open-weight

```bash
curl -X PATCH http://localhost:8001/v1/settings \
  -H "Authorization: Bearer $GANTRY_API_KEY" \
  -d '{
    "provider": "openai",
    "api_key_secret": "ollama",
    "openai_base_url": "http://localhost:11434/v1",
    "sonnet_model": "llama3.1",
    "haiku_model": "llama3.1"
  }'
```

Store `"ollama"` secret as any non-empty string (Ollama ignores the key locally).

---

## Per-task override

Override org defaults for a single task:

```json
{
  "goal": "Refactor auth module",
  "project_id": "...",
  "llm": {
    "provider": "openai",
    "api_key_secret": "openai-prod",
    "sonnet_model": "gpt-4o"
  }
}
```

Priority: task `llm` → org `/v1/settings` → worker env fallback (`ANTHROPIC_API_KEY`).

---

## Self-hosted vs hosted

| Mode | Who pays for tokens |
|---|---|
| **Self-hosted worker** | Customer (their key in `/v1/settings`) |
| **Your hosted worker** | Customer (if BYOK configured) or you (if only worker env keys exist) |

For multi-tenant SaaS, require BYOK in `/v1/settings` before allowing task submission.

---

## Security notes

- API keys live in encrypted org secrets (`GANTRY_SECRETS_KEY` required in production).
- Keys are passed to the worker per-task via Agentex params (same pattern as `github_token`).
- Keys are not stored in task metadata or webhook payloads.
