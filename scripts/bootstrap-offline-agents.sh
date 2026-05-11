#!/usr/bin/env bash
# Offline-agents bootstrap: install Ollama, start it, pull the model.
# Verified targets: macOS, Linux. Windows users: see bootstrap-offline-agents.ps1.
#
# Env overrides:
#   OLLAMA_MODEL  Model tag to pull (default: kimi-k2)
#   OLLAMA_HOST   Server URL (default: http://127.0.0.1:11434)

set -euo pipefail

MODEL="${OLLAMA_MODEL:-kimi-k2}"
OLLAMA_HOST="${OLLAMA_HOST:-http://127.0.0.1:11434}"

log() { printf '[bootstrap] %s\n' "$*"; }

ensure_ollama() {
  if command -v ollama >/dev/null 2>&1; then
    log "Ollama already installed: $(ollama --version 2>/dev/null || echo unknown)"
    return
  fi
  log "Installing Ollama via official install script..."
  curl -fsSL https://ollama.com/install.sh | sh
}

ensure_server() {
  if curl -fsS "${OLLAMA_HOST}/api/tags" >/dev/null 2>&1; then
    log "Ollama server reachable at ${OLLAMA_HOST}"
    return
  fi
  log "Starting Ollama server in background (log: /tmp/ollama.log)..."
  nohup ollama serve >/tmp/ollama.log 2>&1 &
  for _ in $(seq 1 15); do
    if curl -fsS "${OLLAMA_HOST}/api/tags" >/dev/null 2>&1; then
      log "Ollama server up"
      return
    fi
    sleep 1
  done
  log "ERROR: Ollama server did not come up. Check /tmp/ollama.log"
  exit 1
}

pull_model() {
  log "Pulling model: ${MODEL} (this can be large; first pull may take a while)"
  ollama pull "${MODEL}"
}

main() {
  ensure_ollama
  ensure_server
  pull_model
  log "Done."
  log "Try: node offline-agents/run.mjs pm 'Summarize the repo state and propose next steps.'"
}

main "$@"
