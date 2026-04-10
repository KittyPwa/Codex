param(
  [string]$LanguageDir = "",
  [string]$Port = "",
  [switch]$NoOpen
)

$ErrorActionPreference = "Stop"

if ($LanguageDir) {
  $env:TRANSLATOR_LANGUAGE_DIR = $LanguageDir
}

if ($Port) {
  $env:TRANSLATOR_PORT = $Port
}

if ($NoOpen) {
  $env:TRANSLATOR_NO_OPEN = "1"
}

$scriptPath = Join-Path $PSScriptRoot "start-translator.ps1"
& $scriptPath
