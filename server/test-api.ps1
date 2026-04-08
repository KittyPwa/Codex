$ErrorActionPreference = "Stop"
Add-Type -AssemblyName System.Net.Http

$preferredPorts = @(4173, 4174, 4175, 4176, 4177, 4178, 4179, 4180)
$baseUrl = $null

foreach ($port in $preferredPorts) {
  $candidate = "http://localhost:$port"
  try {
    $health = Invoke-RestMethod -Uri "$candidate/api/health" -Method Get -TimeoutSec 3
    if ($health.status -eq "ok") {
      $baseUrl = $candidate
      break
    }
  } catch {
  }
}

if (-not $baseUrl) {
  throw "No running translator API was found on ports $($preferredPorts -join ', ')."
}

Write-Host "Testing translator API at $baseUrl" -ForegroundColor Cyan

$healthResponse = Invoke-RestMethod -Uri "$baseUrl/api/health" -Method Get
Write-Host "Health:" -ForegroundColor Green
$healthResponse | ConvertTo-Json -Depth 6

$translateResponse = Invoke-RestMethod -Uri "$baseUrl/api/translate" -Method Post -ContentType "application/json" -Body '{"action":"english-to-ancient","text":"bring ruin, bring ruin","includeInferred":true}'
Write-Host ""
Write-Host "English -> Ancient:" -ForegroundColor Green
$translateResponse | ConvertTo-Json -Depth 8

$analyzeResponse = Invoke-RestMethod -Uri "$baseUrl/api/translate" -Method Post -ContentType "application/json" -Body '{"action":"analyze-ancient","text":"Tso''koa, Tso''koa","includeInferred":true}'
Write-Host ""
Write-Host "Ancient analysis:" -ForegroundColor Green
$analyzeResponse | ConvertTo-Json -Depth 10

$regressionCases = @(
  @{ text = "Sitacht valkecht licht"; expected = "Before, silence remained." },
  @{ text = "Lan tsar ouk tsal"; expected = "The sun appeared above the sky." },
  @{ text = "Ruvalnacht lan jino tsal ji"; expected = "An omen appeared between the skies." },
  @{ text = "Valkesh sal, nuhkesh sal"; expected = "A stranger came, a guest came." },
  @{ text = "kesh'skehsiar sacht raknacht"; expected = "Our tribe continued the journey." },
  @{ text = "mah-ar tsach kesheh, tah-ar tsocht rek"; expected = "Mother gave breath, father kept the path." },
  @{ text = "Tso'koa valkei"; expected = "Ruin was few." },
  @{ text = "Loo let"; expected = "Good remained always." }
)

Write-Host ""
Write-Host "Regression checks:" -ForegroundColor Green
foreach ($case in $regressionCases) {
  $body = (@{
    action = "analyze-ancient"
    text = $case.text
    includeInferred = $true
  } | ConvertTo-Json)

  $response = Invoke-RestMethod -Uri "$baseUrl/api/translate" -Method Post -ContentType "application/json" -Body $body
  $actual = [string]$response.analysis.idiomaticTranslation
  $status = if ($actual -eq $case.expected) { "OK" } else { "DIFF" }
  Write-Host ("[{0}] {1}" -f $status, $case.text)
  Write-Host ("  expected: {0}" -f $case.expected)
  Write-Host ("  actual:   {0}" -f $actual)
}

$client = [System.Net.Http.HttpClient]::new()
try {
  $content = New-Object System.Net.Http.StringContent('{"includeInferred":true}', [System.Text.Encoding]::UTF8, 'application/json')
  $markdownResponse = $client.PostAsync("$baseUrl/api/export-markdown", $content).Result
  if (-not $markdownResponse.IsSuccessStatusCode) {
    throw "Markdown export failed with HTTP $([int]$markdownResponse.StatusCode)."
  }

  $markdownBody = $markdownResponse.Content.ReadAsStringAsync().Result
  $markdownLines = @($markdownBody -split "`n")
  Write-Host ""
  Write-Host "Markdown export preview:" -ForegroundColor Green
  $markdownLines | Select-Object -First 40
} finally {
  $client.Dispose()
}
