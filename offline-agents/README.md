# Offline AI Agents

Local-first agent setup. Runs entirely against an on-machine Ollama server — no
cloud calls, no API keys. Two minimal agents are shipped:

- **`pm`** — Project Manager. Summaries, SSOT deltas, next-step checklists.
- **`helper`** — Code Helper. Small targeted code snippets / diffs.

## Stack

- **Runtime**: [Ollama](https://ollama.com) (HTTP API on `127.0.0.1:11434`)
- **Model**: `kimi-k2` (Moonshot AI, open weights via Ollama). Override with
  `OLLAMA_MODEL`.
- **Harness**: Node 18+ ESM scripts, zero dependencies (uses global `fetch`).

> **Note on tooling names.** The original spec mentioned "OpenClaw" and
> "Kimi K2.6". Neither is a verifiable upstream identifier at time of writing.
> This setup uses (a) the canonical `kimi-k2` tag — override via env if a
> specific quantization tag is required, and (b) an in-repo harness instead of
> a third-party agent runner. If you intended **OpenHands**
> (`All-Hands-AI/OpenHands`) or a different framework, open an issue and we'll
> wire it in here.

## Quickstart

```bash
# 1. Install Ollama + pull the model (macOS / Linux).
bash scripts/bootstrap-offline-agents.sh

# Windows:
# powershell -File scripts\bootstrap-offline-agents.ps1

# 2. Run an agent.
node offline-agents/run.mjs pm "Summarize the repo state and propose next steps."
node offline-agents/run.mjs helper "Write a TS type guard for { ok: true, data: T } | { ok: false, error: string }."
```

## Flow

```
   user prompt
       │
       ▼
  run.mjs (CLI) ──► runtime.mjs ──► Ollama /api/chat ──► kimi-k2 (local)
                          │
                          └──► offline-agents/logs/events.jsonl  (SSOT log)
```

Every request/response is appended to `offline-agents/logs/events.jsonl` as a
single JSON line. That file is the single source of truth for what each agent
saw and produced — grep it, diff it, or feed it back to the `pm` agent for
summarization.

## Configuration

| Env var | Default | Purpose |
| --- | --- | --- |
| `OLLAMA_HOST` | `http://127.0.0.1:11434` | Ollama HTTP endpoint |
| `OLLAMA_MODEL` | `kimi-k2` | Model tag passed to `/api/chat` and `ollama pull` |

## Files

- `scripts/bootstrap-offline-agents.sh` — bash installer (macOS/Linux)
- `scripts/bootstrap-offline-agents.ps1` — PowerShell installer (Windows)
- `offline-agents/runtime.mjs` — Ollama client + agent definitions + logger
- `offline-agents/run.mjs` — CLI entry point
- `offline-agents/logs/` — append-only JSONL event log (gitignored)

## Extending

Add an agent by inserting an entry in `agents` inside `runtime.mjs`:

```js
agents.reviewer = {
  name: "reviewer",
  system: "You are a strict code reviewer. Output: ISSUES, SUGGESTIONS.",
};
```

Then: `node offline-agents/run.mjs reviewer "<paste diff here>"`.
