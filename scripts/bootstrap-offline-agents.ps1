# Offline-agents bootstrap (Windows / PowerShell).
# Installs Ollama if missing, starts the server, and pulls the model.
#
# Env overrides:
#   $env:OLLAMA_MODEL  Model tag to pull (default: kimi-k2)
#   $env:OLLAMA_HOST   Server URL (default: http://127.0.0.1:11434)

$ErrorActionPreference = "Stop"

$Model       = if ($env:OLLAMA_MODEL) { $env:OLLAMA_MODEL } else { "kimi-k2" }
$OllamaHost  = if ($env:OLLAMA_HOST)  { $env:OLLAMA_HOST }  else { "http://127.0.0.1:11434" }

function Log($msg) { Write-Host "[bootstrap] $msg" }

function Ensure-Ollama {
  if (Get-Command ollama -ErrorAction SilentlyContinue) {
    Log "Ollama already installed."
    return
  }
  Log "Installing Ollama via winget..."
  winget install --id=Ollama.Ollama -e --accept-source-agreements --accept-package-agreements
}

function Ensure-Server {
  try {
    Invoke-WebRequest -Uri "$OllamaHost/api/tags" -UseBasicParsing -TimeoutSec 2 | Out-Null
    Log "Ollama server reachable at $OllamaHost"
    return
  } catch { }
  Log "Starting Ollama server in background..."
  Start-Process -FilePath "ollama" -ArgumentList "serve" -WindowStyle Hidden
  for ($i = 0; $i -lt 15; $i++) {
    Start-Sleep -Seconds 1
    try {
      Invoke-WebRequest -Uri "$OllamaHost/api/tags" -UseBasicParsing -TimeoutSec 2 | Out-Null
      Log "Ollama server up"
      return
    } catch { }
  }
  throw "Ollama server did not come up."
}

function Pull-Model {
  Log "Pulling model: $Model"
  ollama pull $Model
}

Ensure-Ollama
Ensure-Server
Pull-Model
Log "Done. Try: node offline-agents/run.mjs pm 'Summarize the repo state and propose next steps.'"
