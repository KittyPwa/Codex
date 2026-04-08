$ErrorActionPreference = "Stop"

$root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$preferredPorts = @(4173, 4174, 4175, 4176, 4177, 4178, 4179, 4180)
$lexiconPath = Join-Path $root "data\\lexicon.json"
$rulesPath = Join-Path $root "data\\rules-notes.md"

Add-Type -AssemblyName System.Web

function Get-ContentType($path) {
  switch ([System.IO.Path]::GetExtension($path).ToLowerInvariant()) {
    ".html" { "text/html; charset=utf-8" }
    ".css" { "text/css; charset=utf-8" }
    ".js" { "application/javascript; charset=utf-8" }
    ".json" { "application/json; charset=utf-8" }
    ".md" { "text/markdown; charset=utf-8" }
    ".txt" { "text/plain; charset=utf-8" }
    default { "application/octet-stream" }
  }
}

function Write-BytesResponse($context, $statusCode, $bytes, $contentType) {
  $context.Response.StatusCode = $statusCode
  $context.Response.ContentType = $contentType
  $context.Response.ContentLength64 = $bytes.Length
  $context.Response.OutputStream.Write($bytes, 0, $bytes.Length)
  $context.Response.OutputStream.Close()
}

function Write-Response($context, $statusCode, $body, $contentType = "text/plain; charset=utf-8") {
  $bytes = [System.Text.Encoding]::UTF8.GetBytes($body)
  Write-BytesResponse $context $statusCode $bytes $contentType
}

function Write-JsonResponse($context, $statusCode, $value) {
  $json = $value | ConvertTo-Json -Depth 16
  Write-Response $context $statusCode $json "application/json; charset=utf-8"
}

function Read-RequestBody($request) {
  $reader = [System.IO.StreamReader]::new($request.InputStream, $request.ContentEncoding)
  try {
    return $reader.ReadToEnd()
  } finally {
    $reader.Dispose()
  }
}

function Resolve-SafePath($requestPath) {
  $relative = [System.Uri]::UnescapeDataString($requestPath.TrimStart("/"))
  if ([string]::IsNullOrWhiteSpace($relative)) {
    $relative = "index.html"
  }

  $candidate = [System.IO.Path]::GetFullPath((Join-Path $root $relative))
  if (-not $candidate.StartsWith($root, [System.StringComparison]::OrdinalIgnoreCase)) {
    return $null
  }

  return $candidate
}

function Normalize-LexiconEntries($value) {
  if ($null -eq $value) {
    return @()
  }

  if ($value -isnot [System.Collections.IEnumerable] -or $value -is [string]) {
    return @()
  }

  $items = @($value)
  if (
    $items.Count -eq 1 -and
    $items[0] -is [pscustomobject] -and
    $null -ne $items[0].PSObject.Properties["value"] -and
    $items[0].value -is [System.Collections.IEnumerable]
  ) {
    return @($items[0].value)
  }

  return $items
}

function Read-LexiconPayload() {
  if (-not (Test-Path -LiteralPath $lexiconPath -PathType Leaf)) {
    throw "Missing lexicon.json."
  }

  $raw = Get-Content -LiteralPath $lexiconPath -Raw -Encoding UTF8
  $parsed = $raw | ConvertFrom-Json

  if ($parsed -is [System.Collections.IEnumerable] -and $parsed -isnot [string]) {
    return [ordered]@{
      confirmed = Normalize-LexiconEntries $parsed
      inferred = @()
    }
  }

  return [ordered]@{
    confirmed = Normalize-LexiconEntries $parsed.confirmed
    inferred = Normalize-LexiconEntries $parsed.inferred
  }
}

function Write-LexiconPayload($payload) {
  $normalized = [ordered]@{
    confirmed = Normalize-LexiconEntries $payload.confirmed
    inferred = Normalize-LexiconEntries $payload.inferred
  }

  $json = $normalized | ConvertTo-Json -Depth 32
  [System.IO.File]::WriteAllText($lexiconPath, $json, [System.Text.UTF8Encoding]::new($false))
  return $normalized
}

function Handle-ApiRequest($context) {
  $path = $context.Request.Url.AbsolutePath.TrimEnd("/")
  if ([string]::IsNullOrWhiteSpace($path)) {
    $path = "/"
  }

  if ($path -eq "/api/lexicon") {
    if ($context.Request.HttpMethod -eq "GET") {
      Write-JsonResponse $context 200 (Read-LexiconPayload)
      return $true
    }

    if ($context.Request.HttpMethod -eq "PUT") {
      $body = Read-RequestBody $context.Request
      $parsed = $body | ConvertFrom-Json
      $saved = Write-LexiconPayload $parsed
      Write-JsonResponse $context 200 $saved
      return $true
    }

    Write-Response $context 405 "Method Not Allowed"
    return $true
  }

  if ($path -eq "/api/rules-notes") {
    if ($context.Request.HttpMethod -eq "GET") {
      if (-not (Test-Path -LiteralPath $rulesPath -PathType Leaf)) {
        Write-Response $context 200 "" "text/markdown; charset=utf-8"
        return $true
      }

      $markdown = Get-Content -LiteralPath $rulesPath -Raw -Encoding UTF8
      Write-Response $context 200 $markdown "text/markdown; charset=utf-8"
      return $true
    }

    if ($context.Request.HttpMethod -eq "PUT") {
      $body = Read-RequestBody $context.Request
      [System.IO.File]::WriteAllText($rulesPath, $body, [System.Text.UTF8Encoding]::new($false))
      Write-Response $context 200 $body "text/markdown; charset=utf-8"
      return $true
    }

    Write-Response $context 405 "Method Not Allowed"
    return $true
  }

  return $false
}

$listener = $null
$indexUrl = $null

foreach ($port in $preferredPorts) {
  $candidatePrefix = "http://localhost:$port/"
  $candidateListener = [System.Net.HttpListener]::new()
  $candidateListener.Prefixes.Add($candidatePrefix)

  try {
    $candidateListener.Start()
    $listener = $candidateListener
    $indexUrl = "${candidatePrefix}index.html"
    break
  } catch {
    $candidateListener.Close()
  }
}

if (-not $listener) {
  Write-Host "Could not start a local server on ports $($preferredPorts -join ', ')." -ForegroundColor Red
  throw "No available localhost port found for the translator server."
}

Start-Process $indexUrl | Out-Null
Write-Host "Ancient Tongue translator is running at $indexUrl" -ForegroundColor Green
Write-Host "Press Ctrl+C to stop the server." -ForegroundColor Yellow

try {
  while ($listener.IsListening) {
    $context = $listener.GetContext()
    try {
      if (Handle-ApiRequest $context) {
        continue
      }

      $path = Resolve-SafePath $context.Request.Url.AbsolutePath
      if (-not $path) {
        Write-Response $context 403 "Forbidden"
        continue
      }

      if (-not (Test-Path -LiteralPath $path -PathType Leaf)) {
        Write-Response $context 404 "Not Found"
        continue
      }

      $bytes = [System.IO.File]::ReadAllBytes($path)
      Write-BytesResponse $context 200 $bytes (Get-ContentType $path)
    } catch {
      Write-Response $context 500 "Internal Server Error"
    }
  }
} finally {
  $listener.Stop()
  $listener.Close()
}
