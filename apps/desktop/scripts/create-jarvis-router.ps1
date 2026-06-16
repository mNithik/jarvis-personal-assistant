param(
  [string]$BaseModel = "llama3.2:3b",
  [string]$ModelName = "jarvis-router"
)

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$modelfile = Join-Path $scriptDir "..\training\jarvis-router.Modelfile"

if (-not (Test-Path $modelfile)) {
  Write-Error "Modelfile not found: $modelfile"
  exit 1
}

Write-Host "Pulling base model $BaseModel (if needed)..."
ollama pull $BaseModel

Write-Host "Creating $ModelName from $modelfile ..."
ollama create $ModelName -f $modelfile

Write-Host "Done. Enable jarvis-router in Gateway settings, then verify with:"
Write-Host "  cargo test --lib training::eval_gate -j 1"
