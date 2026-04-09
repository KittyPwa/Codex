$ErrorActionPreference = "Stop"

$root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
function Resolve-ProjectDataPath($configuredPath, $defaultRelativePath) {
  $candidate = if ([string]::IsNullOrWhiteSpace($configuredPath)) {
    if ([System.IO.Path]::IsPathRooted($defaultRelativePath)) {
      $defaultRelativePath
    } else {
      Join-Path $root $defaultRelativePath
    }
  } elseif ([System.IO.Path]::IsPathRooted($configuredPath)) {
    $configuredPath
  } else {
    Join-Path $root $configuredPath
  }

  return [System.IO.Path]::GetFullPath($candidate)
}

function Get-PreferredPorts() {
  $configured = if (-not [string]::IsNullOrWhiteSpace($env:TRANSLATOR_PORTS)) {
    [string]$env:TRANSLATOR_PORTS
  } elseif (-not [string]::IsNullOrWhiteSpace($env:TRANSLATOR_PORT)) {
    [string]$env:TRANSLATOR_PORT
  } else {
    ""
  }

  if (-not $configured) {
    return @(4173, 4174, 4175, 4176, 4177, 4178, 4179, 4180)
  }

  $ports = New-Object System.Collections.Generic.List[int]
  foreach ($segment in ($configured -split "[,\s;]+")) {
    if (-not $segment) {
      continue
    }

    $parsed = 0
    if ([int]::TryParse($segment, [ref]$parsed) -and $parsed -gt 0) {
      [void]$ports.Add($parsed)
    }
  }

  if (-not $ports.Count) {
    throw "No valid ports were provided in TRANSLATOR_PORT or TRANSLATOR_PORTS."
  }

  return @($ports.ToArray())
}

$preferredPorts = Get-PreferredPorts

$languagePackRoot = Resolve-ProjectDataPath $env:TRANSLATOR_LANGUAGE_DIR "data"
$lexiconPath = Resolve-ProjectDataPath $env:TRANSLATOR_LEXICON_PATH (Join-Path $languagePackRoot "lexicon.json")
$rulesPath = Resolve-ProjectDataPath $env:TRANSLATOR_RULES_NOTES_PATH (Join-Path $languagePackRoot "rules-notes.md")
$rulesConfigPath = Resolve-ProjectDataPath $env:TRANSLATOR_RULES_CONFIG_PATH (Join-Path $languagePackRoot "rules.json")

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

function Read-RulesConfig() {
  if (-not (Test-Path -LiteralPath $rulesConfigPath -PathType Leaf)) {
    return [pscustomobject]@{}
  }

  $raw = Get-Content -LiteralPath $rulesConfigPath -Raw -Encoding UTF8
  if ([string]::IsNullOrWhiteSpace($raw)) {
    return [pscustomobject]@{}
  }

  return $raw | ConvertFrom-Json
}

function Get-ConfigValue($Object, $Path, $Default = $null) {
  $current = $Object
  foreach ($segment in ($Path -split "\.")) {
    if ($null -eq $current) {
      return $Default
    }

    $property = $current.PSObject.Properties[$segment]
    if ($null -eq $property) {
      return $Default
    }

    $current = $property.Value
  }

  if ($null -eq $current) {
    return $Default
  }

  return $current
}

function Get-LanguageMetadata($rulesConfig) {
  $language = Get-ConfigValue $rulesConfig "language" ([pscustomobject]@{})
  $name = [string](Get-ConfigValue $language "name" "Translator language")
  $version = [string](Get-ConfigValue $language "version" "0.0.0")
  $description = [string](Get-ConfigValue $language "description" "")

  return [ordered]@{
    name = $name
    version = $version
    description = $description
  }
}

function Add-ValidationIssue($bucket, $severity, $message) {
  $bucket += ,([ordered]@{
    severity = $severity
    message = $message
  })

  return ,$bucket
}

function Test-ConfigHasValue($rulesConfig, $path) {
  $sentinel = [guid]::NewGuid().ToString()
  $value = Get-ConfigValue $rulesConfig $path $sentinel
  return $value -ne $sentinel -and $null -ne $value
}

function Get-LanguagePackValidation($lexiconPayload, $rulesConfig) {
  $issues = @()
  $confirmed = Normalize-LexiconEntries $lexiconPayload.confirmed
  $inferred = Normalize-LexiconEntries $lexiconPayload.inferred
  $entries = @($confirmed)
  if ($inferred.Count) {
    $entries += @($inferred)
  }
  $language = Get-LanguageMetadata $rulesConfig

  if (-not $confirmed.Count) {
    $issues = Add-ValidationIssue $issues "error" "The language pack must contain at least one confirmed lexicon entry."
  }

  $seenAncient = @{}
  foreach ($entry in $entries) {
    $ancient = Normalize-AncientKey $entry.ancient
    if (-not $ancient) {
      $issues = Add-ValidationIssue $issues "error" "Each lexicon entry must define a non-empty 'ancient' form."
      continue
    }

    if ($seenAncient.ContainsKey($ancient)) {
      $issues = Add-ValidationIssue $issues "warning" "Duplicate lexicon entry detected for '$ancient'. Later entries overwrite earlier ones."
    } else {
      $seenAncient[$ancient] = $true
    }

    if (-not (ConvertTo-ArrayValue $entry.meanings).Count) {
      $issues = Add-ValidationIssue $issues "warning" "Lexicon entry '$ancient' has no meanings."
    }
  }

  if (-not $language.name -or $language.name -eq "Translator language") {
    $issues = Add-ValidationIssue $issues "warning" "rules.json should define language.name for clearer pack identification."
  }

  $requiredRulePaths = @(
    "english.fillers",
    "normalization",
    "morphology.productiveSuffixes",
    "morphology.affixMeanings",
    "composition.lexicalCompounds",
    "composition.phraseRenderings",
    "translation.narrativeRenderings"
  )

  foreach ($path in $requiredRulePaths) {
    if (-not (Test-ConfigHasValue $rulesConfig $path)) {
      $issues = Add-ValidationIssue $issues "error" "rules.json is missing required section '$path'."
    }
  }

  $recommendedRulePaths = @(
    "language.version",
    "english.aliases",
    "composition.contextualRenderings",
    "translation.englishToAncientOverrides",
    "translation.syntaxPatterns",
    "translation.nounArticles",
    "translation.objectArticles"
  )

  foreach ($path in $recommendedRulePaths) {
    if (-not (Test-ConfigHasValue $rulesConfig $path)) {
      $issues = Add-ValidationIssue $issues "warning" "rules.json is missing recommended section '$path'. The backend will fall back where possible."
    }
  }

  $renderings = Get-MapFromConfig $rulesConfig "translation.narrativeRenderings"
  foreach ($key in @($renderings.Keys)) {
    $rendering = $renderings[$key]
    $narrative = Get-ConfigValue $rendering "narrative" $null
    $literal = Get-ConfigValue $rendering "literal" $null
    if (-not $narrative -or -not $literal) {
      $issues = Add-ValidationIssue $issues "warning" "Narrative rendering '$key' should define both 'narrative' and 'literal'."
    }
  }

  $syntaxPatterns = ConvertTo-ArrayValue (Get-ConfigValue $rulesConfig "translation.syntaxPatterns" @())
  foreach ($pattern in $syntaxPatterns) {
    $template = [string](Get-ConfigValue $pattern "template" "")
    if (-not $template) {
      $issues = Add-ValidationIssue $issues "warning" "Each syntax pattern should define a non-empty template."
    }

    $match = Get-ConfigValue $pattern "match" $null
    if ($null -eq $match) {
      $issues = Add-ValidationIssue $issues "warning" "Each syntax pattern should define a match block."
    }
  }

  return [ordered]@{
    valid = (@($issues | Where-Object { $_.severity -eq "error" }).Count -eq 0)
    errors = @($issues | Where-Object { $_.severity -eq "error" })
    warnings = @($issues | Where-Object { $_.severity -eq "warning" })
    issues = @($issues)
  }
}

function ConvertTo-ArrayValue($value) {
  if ($null -eq $value) {
    return ,@()
  }

  if ($value -is [string]) {
    return ,@($value)
  }

  if ($value -is [System.Collections.IEnumerable]) {
    return ,@($value)
  }

  return ,@($value)
}

function Normalize-EnglishKey($text) {
  $safeText = if ($null -eq $text) { "" } else { [string]$text }
  return $safeText.ToLowerInvariant().Trim() -replace "\s+", " "
}

function Normalize-AncientKey($text) {
  $safeText = if ($null -eq $text) { "" } else { [string]$text }
  return ($safeText.ToLowerInvariant().Trim() `
    -replace "[’`]", "'" `
    -replace "[–—]", "-")
}

function Normalize-OverrideKey($text) {
  return (Normalize-AncientKey $text) -replace "\s+", " "
}

function Tokenize-TranslatorText($text) {
  $safeText = if ($null -eq $text) { "" } else { [string]$text }
  $matches = [regex]::Matches($safeText, "[A-Za-z']+|\r\n|\r|\n|[ \t]+|[^\sA-Za-z']")
  return @($matches | ForEach-Object { $_.Value })
}

function Join-TranslatorTokens($tokens) {
  $result = ""

  foreach ($token in $tokens) {
    if ($token -match "^(?:\r\n|\r|\n|[ \t]+)$") {
      $result += $token
      continue
    }

    if (-not $result.Length) {
      $result = $token
      continue
    }

    if ($result -match "[\(\[\{\/""'-]$" -or $token -match "^[\)\]\},.!?:;""']") {
      $result += $token
      continue
    }

    $result += " $token"
  }

  return $result
}

function Split-TranslatorLines($text) {
  $safeText = if ($null -eq $text) { "" } else { [string]$text }
  $parts = [regex]::Split($safeText, "(\r\n|\r|\n)")
  $lines = @()

  for ($index = 0; $index -lt $parts.Length; $index += 2) {
    $lines += [ordered]@{
      text = if ($index -lt $parts.Length) { $parts[$index] } else { "" }
      ending = if ($index + 1 -lt $parts.Length) { $parts[$index + 1] } else { "" }
    }
  }

  return $lines
}

function Join-TranslatorLines($values, $lines) {
  $builder = New-Object System.Text.StringBuilder

  for ($index = 0; $index -lt $values.Count; $index += 1) {
    [void]$builder.Append($(if ($null -eq $values[$index]) { "" } else { $values[$index] }))
    if ($index -lt $lines.Count) {
      [void]$builder.Append($(if ($null -eq $lines[$index].ending) { "" } else { $lines[$index].ending }))
    }
  }

  return $builder.ToString()
}

function New-TranslationContext($includeInferred) {
  $lexiconPayload = Read-LexiconPayload
  $rulesConfig = Read-RulesConfig
  $language = Get-LanguageMetadata $rulesConfig
  $validation = Get-LanguagePackValidation $lexiconPayload $rulesConfig
  if (-not $validation.valid) {
    $messages = @($validation.errors | ForEach-Object { $_.message })
    throw ("Invalid language pack: {0}" -f ($messages -join " "))
  }
  $confirmed = Normalize-LexiconEntries $lexiconPayload.confirmed
  $inferred = Normalize-LexiconEntries $lexiconPayload.inferred
  $entries = @($confirmed)
  if ($includeInferred) {
    $entries += @($inferred)
  }

  $entryMap = @{}
  foreach ($entry in $entries) {
    if ($entry.ancient) {
      $entryMap[(Normalize-AncientKey $entry.ancient)] = $entry
    }
  }

  $englishMap = @{}
  foreach ($entry in $entries) {
    foreach ($meaning in (ConvertTo-ArrayValue $entry.meanings)) {
      $normalized = Normalize-EnglishKey $meaning
      if (-not $normalized) {
        continue
      }

      if (-not $englishMap.ContainsKey($normalized)) {
        $englishMap[$normalized] = $entry.ancient
      }

      if ($normalized.StartsWith("to ")) {
        $trimmed = $normalized.Substring(3)
        if (-not $englishMap.ContainsKey($trimmed)) {
          $englishMap[$trimmed] = $entry.ancient
        }
      }
    }
  }

  foreach ($alias in (Get-ConfigValue $rulesConfig "english.aliases" ([pscustomobject]@{})).PSObject.Properties) {
    if (-not $englishMap.ContainsKey($alias.Name)) {
      $englishMap[$alias.Name] = $alias.Value
    }
  }

  return [ordered]@{
    Language = $language
    Lexicon = $lexiconPayload
    Rules = $rulesConfig
    Validation = $validation
    Entries = $entries
    EntryMap = $entryMap
    EnglishMap = $englishMap
    Paths = [ordered]@{
      lexicon = $lexiconPath
      rulesConfig = $rulesConfigPath
      rulesNotes = $rulesPath
    }
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

function Get-LexiconEntry($context, $key) {
  $normalized = Normalize-AncientKey $key
  if ($context.EntryMap.ContainsKey($normalized)) {
    return $context.EntryMap[$normalized]
  }

  return $null
}

function Get-HashSetFromConfig($rules, $path) {
  $set = New-Object System.Collections.Generic.HashSet[string] ([System.StringComparer]::OrdinalIgnoreCase)
  foreach ($item in (ConvertTo-ArrayValue (Get-ConfigValue $rules $path @()))) {
    if ($item) {
      [void]$set.Add((Normalize-AncientKey $item))
    }
  }
  return $set
}

function Get-StringSetFromConfig($rules, $path) {
  $set = New-Object System.Collections.Generic.HashSet[string] ([System.StringComparer]::OrdinalIgnoreCase)
  foreach ($item in (ConvertTo-ArrayValue (Get-ConfigValue $rules $path @()))) {
    if ($item) {
      $safeItem = if ($null -eq $item) { "" } else { [string]$item }
      [void]$set.Add($safeItem.ToLowerInvariant())
    }
  }
  return $set
}

function Get-MapFromConfig($rules, $path) {
  $map = @{}
  $source = Get-ConfigValue $rules $path ([pscustomobject]@{})
  foreach ($property in $source.PSObject.Properties) {
    $map[$property.Name] = $property.Value
  }
  return $map
}

function Get-NormalizedMapFromConfig($rules, $path, $keyNormalizer) {
  $map = @{}
  foreach ($property in (Get-ConfigValue $rules $path ([pscustomobject]@{})).PSObject.Properties) {
    $normalizedKey = & $keyNormalizer $property.Name
    if ($normalizedKey) {
      $map[$normalizedKey] = $property.Value
    }
  }
  return $map
}

function Test-ConfiguredSequence($actual, $expected) {
  $expectedValues = ConvertTo-ArrayValue $expected
  if (-not $expectedValues.Count -or $actual.Count -lt $expectedValues.Count) {
    return $false
  }

  for ($index = 0; $index -lt $expectedValues.Count; $index += 1) {
    $expectedValue = Normalize-AncientKey $expectedValues[$index]
    if ($expectedValue -eq "*") {
      continue
    }

    if ($actual[$index] -ne $expectedValue) {
      return $false
    }
  }

  return $true
}

function Find-LongestEnglishMatch($context, $tokens, $startIndex) {
  $bestMatch = $null
  $phraseParts = @()

  for ($cursor = $startIndex; $cursor -lt $tokens.Count; $cursor += 1) {
    $token = $tokens[$cursor]

    if ($token -match "^(?:\r\n|\r|\n)$") {
      break
    }

    if ($token -match "^[ \t]+$") {
      continue
    }

    if ($token -notmatch "[A-Za-z']") {
      break
    }

    $phraseParts += (Normalize-EnglishKey $token)
    $phrase = ($phraseParts -join " ").Trim()

    if ($context.EnglishMap.ContainsKey($phrase)) {
      $bestMatch = [ordered]@{
        ancient = $context.EnglishMap[$phrase]
        length = $cursor - $startIndex + 1
      }
    }
  }

  return $bestMatch
}

function Find-PoeticEnglishOverride($context, $text) {
  $map = Get-NormalizedMapFromConfig $context.Rules "translation.englishToAncientOverrides" ${function:Normalize-EnglishKey}
  $normalized = Normalize-EnglishKey $text
  if ($map.ContainsKey($normalized)) {
    return [string]$map[$normalized]
  }

  return $null
}

function Translate-EnglishToAncientApi($context, $text) {
  $fillers = Get-StringSetFromConfig $context.Rules "english.fillers"
  $lines = Split-TranslatorLines $text
  $translated = @()

  foreach ($line in $lines) {
    if (-not $line.text.Trim()) {
      $translated += $line.text
      continue
    }

    $override = Find-PoeticEnglishOverride $context $line.text
    if ($override) {
      $translated += $override
      continue
    }

    $tokens = Tokenize-TranslatorText $line.text
    $output = New-Object System.Collections.Generic.List[string]
    $index = 0

    while ($index -lt $tokens.Count) {
      $token = [string]$tokens[$index]

      if ($token -notmatch "[A-Za-z']") {
        [void]$output.Add($token)
        $index += 1
        continue
      }

      $match = Find-LongestEnglishMatch $context $tokens $index
      if ($match) {
        [void]$output.Add($match.ancient)
        $index += [int]$match.length
        continue
      }

      $lowerToken = $token.ToLowerInvariant()
      if ($fillers.Contains($lowerToken)) {
        $index += 1
        continue
      }

      [void]$output.Add("[$lowerToken]")
      $index += 1
    }

    $translated += (Join-TranslatorTokens (@($output)))
  }

  return Join-TranslatorLines $translated $lines
}

function Resolve-Normalization($context, $token) {
  $normalizationMap = Get-MapFromConfig $context.Rules "normalization"
  if (-not $normalizationMap.ContainsKey($token)) {
    return $null
  }

  $mapped = [string]$normalizationMap[$token]
  if ($mapped.Contains("+")) {
    return @($mapped -split "\+" | ForEach-Object { Normalize-AncientKey $_ })
  }

  return @((Normalize-AncientKey $mapped))
}

function Split-ProductiveSuffix($context, $token) {
  $suffixes = ConvertTo-ArrayValue (Get-ConfigValue $context.Rules "morphology.productiveSuffixes" @())
  foreach ($suffix in $suffixes) {
    if (-not $token.EndsWith($suffix) -or $token -eq $suffix) {
      continue
    }

    $stem = $token.Substring(0, $token.Length - $suffix.Length)
    if (Get-LexiconEntry $context $stem) {
      return @($stem, $suffix)
    }
  }

  return $null
}

function Get-LexicalCollapse($context, $parts) {
  $compoundMap = Get-MapFromConfig $context.Rules "composition.lexicalCompounds"
  $key = @($parts) -join "+"
  if ($compoundMap.ContainsKey($key)) {
    return [string]$compoundMap[$key]
  }

  return $null
}

function Get-PhraseRendering($context, $parts) {
  $phraseMap = Get-MapFromConfig $context.Rules "composition.phraseRenderings"
  $key = @($parts) -join "+"
  if ($phraseMap.ContainsKey($key)) {
    return [string]$phraseMap[$key]
  }

  return $null
}

function Get-ContextualRendering($context, $parts) {
  $renderMap = Get-MapFromConfig $context.Rules "composition.contextualRenderings"
  $key = @($parts) -join "+"
  if ($renderMap.ContainsKey($key)) {
    $values = ConvertTo-ArrayValue $renderMap[$key]
    if ($values.Count) {
      return [string]$values[0]
    }
  }

  return $null
}

function Get-NarrativeRendering($context, $headword, $mode = "narrative") {
  $renderMap = Get-MapFromConfig $context.Rules "translation.narrativeRenderings"
  $key = Normalize-AncientKey $headword
  if ($renderMap.ContainsKey($key)) {
    $entry = $renderMap[$key]
    $value = Get-ConfigValue $entry $mode $null
    if ($value) {
      return [string]$value
    }
  }

  return $null
}

function Get-EntryGloss($context, $entry, $mode = "narrative") {
  $meanings = ConvertTo-ArrayValue $entry.meanings
  $primary = if ($meanings.Count) { [string]$meanings[0] } else { [string]$entry.ancient }

  if ($mode -eq "narrative") {
    $render = Get-NarrativeRendering $context $entry.ancient "narrative"
    if ($render) {
      return $render
    }
  }

  if ($mode -eq "literal") {
    $render = Get-NarrativeRendering $context $entry.ancient "literal"
    if ($render) {
      return $render
    }
  }

  if ($mode -eq "narrative" -and $entry.allowNominalReading -and $meanings.Count -gt 1) {
    return [string]$meanings[1]
  }

  return $primary
}

function Build-MorphemeGloss($context, $parts, $fallback) {
  if (-not $parts.Count) {
    return $fallback
  }

  $affixMeanings = Get-MapFromConfig $context.Rules "morphology.affixMeanings"
  $glosses = foreach ($part in $parts) {
    $entry = Get-LexiconEntry $context $part
    if ($entry) {
      $meanings = ConvertTo-ArrayValue $entry.meanings
      if ($meanings.Count) {
        $meanings[0]
        continue
      }
    }

    if ($affixMeanings.ContainsKey($part)) {
      $meanings = ConvertTo-ArrayValue $affixMeanings[$part]
      if ($meanings.Count) {
        $meanings[0]
        continue
      }
    }

    $part
  }

  return ($glosses -join " + ")
}

function New-UnknownAnalysis($token) {
  return [ordered]@{
    token = $token
    headword = $token
    meanings = @("[$token]")
    primaryGloss = "[$token]"
    morphemeGloss = "[$token]"
    literalGloss = "[$token]"
    narrativeGloss = "[$token]"
    resolvedGloss = "[$token]"
    components = @()
    etymology = @()
    notes = @("No direct, normalized, or affixed recovery succeeded.")
    status = "unknown"
    register = "unknown"
    pronunciation = ""
    lexicalized = $false
    path = @("unknown")
    isUnknown = $true
  }
}

function Analyze-AncientTokenApi($context, $token) {
  $normalized = Normalize-AncientKey $token
  $lexicalPriority = Get-HashSetFromConfig $context.Rules "composition.lexicalPriority"
  $entry = if ($lexicalPriority.Contains($normalized)) { Get-LexiconEntry $context $normalized } else { $null }
  if (-not $entry) {
    $entry = Get-LexiconEntry $context $normalized
  }

  if ($entry) {
    $meanings = ConvertTo-ArrayValue $entry.meanings
    $components = ConvertTo-ArrayValue $entry.components
    $componentPath = if ($components.Count) { $components } else { @($normalized) }
    $primaryGloss = if ($meanings.Count) { $meanings[0] } else { $entry.ancient }
    return [ordered]@{
      token = $token
      headword = $entry.ancient
      meanings = @($meanings)
      primaryGloss = $primaryGloss
      morphemeGloss = if ($entry.lexicalized) { $primaryGloss } else { Build-MorphemeGloss $context $components $primaryGloss }
      literalGloss = Get-EntryGloss $context $entry "literal"
      narrativeGloss = Get-EntryGloss $context $entry "narrative"
      resolvedGloss = $(if (Get-PhraseRendering $context $componentPath) { Get-PhraseRendering $context $componentPath } elseif (Get-LexicalCollapse $context $componentPath) { Get-LexicalCollapse $context $componentPath } else { $primaryGloss })
      components = @($components)
      etymology = ConvertTo-ArrayValue $entry.etymology
      notes = ConvertTo-ArrayValue $entry.notes
      status = if ($entry.status) { $entry.status } else { "confirmed" }
      register = if ($entry.register) { $entry.register } else { "ancient" }
      pronunciation = if ($entry.pronunciation) { $entry.pronunciation } else { "" }
      lexicalized = [bool]$entry.lexicalized
      path = @(if ($lexicalPriority.Contains($normalized)) { @("direct", "lexical-priority") } else { @("direct") })
      isUnknown = $false
    }
  }

  $normalizedParts = Resolve-Normalization $context $normalized
  if ($normalizedParts) {
    $resolved = @()
    foreach ($part in $normalizedParts) {
      $resolvedEntry = Get-LexiconEntry $context $part
      if (-not $resolvedEntry) {
        return New-UnknownAnalysis $token
      }
      $resolved += $resolvedEntry
    }

    $lexicalCollapse = Get-LexicalCollapse $context $normalizedParts
    $contextual = Get-ContextualRendering $context $normalizedParts
    return [ordered]@{
      token = $token
      headword = $token
      meanings = @($(if ($lexicalCollapse) { $lexicalCollapse } elseif ($contextual) { $contextual } else { ($resolved | ForEach-Object { $_.meanings[0] }) -join " + " }))
      primaryGloss = $(if ($lexicalCollapse) { $lexicalCollapse } elseif ($contextual) { $contextual } else { ($resolved | ForEach-Object { $_.meanings[0] }) -join " + " })
      morphemeGloss = ($resolved | ForEach-Object { $_.meanings[0] }) -join " + "
      literalGloss = $(if ($lexicalCollapse) { $lexicalCollapse } else { ($resolved | ForEach-Object { Get-EntryGloss $context $_ "literal" }) -join " + " })
      narrativeGloss = $(if ($lexicalCollapse) { $lexicalCollapse } else { ($resolved | ForEach-Object { Get-EntryGloss $context $_ "narrative" }) -join " + " })
      resolvedGloss = $(if (Get-PhraseRendering $context $normalizedParts) { Get-PhraseRendering $context $normalizedParts } elseif ($lexicalCollapse) { $lexicalCollapse } elseif ($contextual) { $contextual } else { (($resolved | ForEach-Object { $_.meanings[0] }) -join " + ") })
      components = @($normalizedParts)
      etymology = @()
      notes = @("Recovered through normalization.")
      status = "inferred"
      register = "ancient"
      pronunciation = ""
      lexicalized = $false
      path = @("normalized")
      isUnknown = $false
    }
  }

  $suffixParts = Split-ProductiveSuffix $context $normalized
  if ($suffixParts) {
    $resolved = @()
    foreach ($part in $suffixParts) {
      $resolvedEntry = Get-LexiconEntry $context $part
      if (-not $resolvedEntry) {
        return New-UnknownAnalysis $token
      }
      $resolved += $resolvedEntry
    }

    $lexicalCollapse = Get-LexicalCollapse $context $suffixParts
    return [ordered]@{
      token = $token
      headword = $token
      meanings = @($(if ($lexicalCollapse) { $lexicalCollapse } else { ($resolved | ForEach-Object { $_.meanings[0] }) -join " + " }))
      primaryGloss = $(if ($lexicalCollapse) { $lexicalCollapse } else { ($resolved | ForEach-Object { $_.meanings[0] }) -join " + " })
      morphemeGloss = ($resolved | ForEach-Object { $_.meanings[0] }) -join " + "
      literalGloss = $(if ($lexicalCollapse) { $lexicalCollapse } else { ($resolved | ForEach-Object { Get-EntryGloss $context $_ "literal" }) -join " + " })
      narrativeGloss = $(if ($lexicalCollapse) { $lexicalCollapse } else { ($resolved | ForEach-Object { Get-EntryGloss $context $_ "narrative" }) -join " + " })
      resolvedGloss = $(if (Get-PhraseRendering $context $suffixParts) { Get-PhraseRendering $context $suffixParts } elseif ($lexicalCollapse) { $lexicalCollapse } else { (($resolved | ForEach-Object { $_.meanings[0] }) -join " + ") })
      components = @($suffixParts)
      etymology = @()
      notes = @("Recovered by productive suffix split.")
      status = "segmented"
      register = "ancient"
      pronunciation = ""
      lexicalized = $false
      path = @("suffix")
      isUnknown = $false
    }
  }

  return New-UnknownAnalysis $token
}

function Get-NarrativeOverride($context, $lineText, $heads, $components) {
  $poeticOverrides = Get-MapFromConfig $context.Rules "translation.poeticOverrides"
  $overrideKey = Normalize-OverrideKey $lineText
  if ($poeticOverrides.ContainsKey($overrideKey)) {
    return [string]$poeticOverrides[$overrideKey]
  }

  foreach ($pattern in (ConvertTo-ArrayValue (Get-ConfigValue $context.Rules "translation.headSequenceOverrides" @()))) {
    if (Test-ConfiguredSequence $heads (ConvertTo-ArrayValue $pattern.heads) -and (ConvertTo-ArrayValue $pattern.heads).Count -eq $heads.Count) {
      return [string]$pattern.output
    }
  }

  foreach ($pattern in (ConvertTo-ArrayValue (Get-ConfigValue $context.Rules "translation.componentSequenceOverrides" @()))) {
    if (Test-ConfiguredSequence $components (ConvertTo-ArrayValue $pattern.components) -and (ConvertTo-ArrayValue $pattern.components).Count -eq $components.Count) {
      return [string]$pattern.output
    }
  }

  return $null
}

function Resolve-SubjectText($context, $word) {
  $subjectRenderings = Get-MapFromConfig $context.Rules "translation.subjectRenderings"
  $nounArticles = Get-MapFromConfig $context.Rules "translation.nounArticles"
  $safeWord = if ($null -eq $word) { "" } else { [string]$word }
  $lower = $safeWord.ToLowerInvariant()

  if ($subjectRenderings.ContainsKey($lower)) {
    return [string]$subjectRenderings[$lower]
  }

  if ($nounArticles.ContainsKey($lower) -and $nounArticles[$lower] -eq "the") {
    return "the $word"
  }

  return $word
}

function Resolve-ObjectText($context, $words) {
  $parts = @($words | Where-Object { $_ })
  if (-not $parts.Count) {
    return ""
  }

  $joined = ($parts -join " ").Trim()
  $objectArticles = Get-MapFromConfig $context.Rules "translation.objectArticles"
  $lower = $joined.ToLowerInvariant()

  if ($objectArticles.ContainsKey($lower)) {
    return "$($objectArticles[$lower]) $joined"
  }

  return $joined
}

function Capitalize-Text($value) {
  $text = if ($null -eq $value) { "" } else { [string]$value }
  if ([string]::IsNullOrWhiteSpace($text)) {
    return ""
  }

  if ($text.Length -eq 1) {
    return $text.ToUpper()
  }

  return $text.Substring(0,1).ToUpper() + $text.Substring(1)
}

function Build-LiteralLineApi($context, $analyses) {
  $components = @($analyses | ForEach-Object {
    if ($_.components.Count) { $_.components } else { Normalize-AncientKey $_.headword }
  })

  if (Get-PhraseRendering $context $components) {
    return Get-PhraseRendering $context $components
  }

  if (Get-LexicalCollapse $context $components) {
    return Get-LexicalCollapse $context $components
  }

  $hiddenMarkers = Get-HashSetFromConfig $context.Rules "morphology.hiddenTranslationMarkers"
  $words = @($analyses | ForEach-Object {
    if ($_.resolvedGloss) { $_.resolvedGloss }
    elseif ($_.literalGloss) { $_.literalGloss }
    else { $_.primaryGloss }
  })

  return (@($words | Where-Object { $_ -and -not $hiddenMarkers.Contains((Normalize-AncientKey $_)) }) -join " ").Trim()
}

function Resolve-LocationText($context, $heads, $tailWords) {
  foreach ($pattern in (ConvertTo-ArrayValue (Get-ConfigValue $context.Rules "translation.tailRenderings" @()))) {
    $includes = ConvertTo-ArrayValue $pattern.includes
    if ($includes.Count -and ($includes | Where-Object { $heads -contains $_ }).Count -eq $includes.Count) {
      return [string]$pattern.output
    }
  }

  return (@($tailWords) -join " ")
}

function Test-SyntaxPattern($pattern, $heads, $components) {
  $match = Get-ConfigValue $pattern "match" ([pscustomobject]@{})
  $minHeads = [int](Get-ConfigValue $match "minHeads" 0)
  if ($heads.Count -lt $minHeads) {
    return $false
  }

  $headSequence = ConvertTo-ArrayValue (Get-ConfigValue $match "headSequence" @())
  if ($headSequence.Count -and -not (Test-ConfiguredSequence $heads $headSequence)) {
    return $false
  }

  $componentSequence = ConvertTo-ArrayValue (Get-ConfigValue $match "componentSequence" @())
  if ($componentSequence.Count -and -not (Test-ConfiguredSequence $components $componentSequence)) {
    return $false
  }

  foreach ($headMatcher in (ConvertTo-ArrayValue (Get-ConfigValue $match "heads" @()))) {
    $index = [int](Get-ConfigValue $headMatcher "index" -1)
    if ($index -lt 0 -or $index -ge $heads.Count) {
      return $false
    }

    $expected = Normalize-AncientKey (Get-ConfigValue $headMatcher "equals" "")
    if ($expected -and $heads[$index] -ne $expected) {
      return $false
    }
  }

  return $true
}

function Resolve-SyntaxPatternSegment($context, $resolvedWords, $heads, $segment) {
  if ($null -eq $segment) {
    return ""
  }

  $mode = [string](Get-ConfigValue $segment "mode" "raw")
  $index = [int](Get-ConfigValue $segment "index" -1)
  $start = [int](Get-ConfigValue $segment "start" -1)

  if ($mode -eq "verb") {
    $verbIndex = if ($index -ge 0) { $index } else { 0 }
    if ($verbIndex -lt 0 -or $verbIndex -ge $heads.Count) {
      return ""
    }

    $explicitValue = Get-ConfigValue $segment "value" $null
    if ($explicitValue) {
      return [string]$explicitValue
    }

    return [string](Get-NarrativeRendering $context $heads[$verbIndex] "narrative")
  }

  $words = @()
  if ($index -ge 0) {
    if ($index -lt $resolvedWords.Count) {
      $words = @($resolvedWords[$index])
    }
  } elseif ($start -ge 0) {
    if ($start -lt $resolvedWords.Count) {
      $words = @($resolvedWords | Select-Object -Skip $start)
    }
  }

  $text = switch ($mode) {
    "subject" { Resolve-SubjectText $context ($(if ($words.Count) { $words[0] } else { "" })) }
    "object" { Resolve-ObjectText $context $words }
    "location" { Resolve-LocationText $context (@($heads | Select-Object -Skip $start)) $words }
    "continuation" {
      if ($words.Count -le 1) {
        Resolve-ObjectText $context $words
      } else {
        Resolve-LocationText $context (@($heads | Select-Object -Skip $start)) $words
      }
    }
    default { (@($words | Where-Object { $_ }) -join " ").Trim() }
  }

  if ([string]::IsNullOrWhiteSpace($text)) {
    return ""
  }

  $prefix = [string](Get-ConfigValue $segment "prefix" "")
  $suffix = [string](Get-ConfigValue $segment "suffix" "")
  return "$prefix$text$suffix"
}

function Invoke-SyntaxPattern($context, $resolvedWords, $heads, $components) {
  foreach ($pattern in (ConvertTo-ArrayValue (Get-ConfigValue $context.Rules "translation.syntaxPatterns" @()))) {
    if (-not (Test-SyntaxPattern $pattern $heads $components)) {
      continue
    }

    $template = [string](Get-ConfigValue $pattern "template" "")
    if (-not $template) {
      continue
    }

    $replacements = @{
      "{subject}" = Resolve-SyntaxPatternSegment $context $resolvedWords $heads (Get-ConfigValue $pattern "subject" $null)
      "{object}" = Resolve-SyntaxPatternSegment $context $resolvedWords $heads (Get-ConfigValue $pattern "object" $null)
      "{tail}" = Resolve-SyntaxPatternSegment $context $resolvedWords $heads (Get-ConfigValue $pattern "tail" $null)
      "{firstObject}" = Resolve-SyntaxPatternSegment $context $resolvedWords $heads (Get-ConfigValue $pattern "firstObject" $null)
      "{secondObject}" = Resolve-SyntaxPatternSegment $context $resolvedWords $heads (Get-ConfigValue $pattern "secondObject" $null)
      "{verb}" = Resolve-SyntaxPatternSegment $context $resolvedWords $heads (Get-ConfigValue $pattern "verb" ([pscustomobject]@{ mode = "verb"; index = 0 }))
      "{secondVerb}" = Resolve-SyntaxPatternSegment $context $resolvedWords $heads (Get-ConfigValue $pattern "secondVerb" $null)
    }

    foreach ($placeholder in $replacements.Keys) {
      $template = $template.Replace($placeholder, [string]$replacements[$placeholder])
    }

    $sentence = $template -replace "\s+", " "
    $sentence = $sentence -replace "\s+([,.;!?])", '$1'
    $sentence = $sentence.Trim()
    if ([bool](Get-ConfigValue $pattern "capitalize" $true)) {
      $sentence = Capitalize-Text $sentence
    }
    return $sentence
  }

  return $null
}

function Analyze-AncientLineApi($context, $lineText) {
  $tokens = Tokenize-TranslatorText $lineText
  $wordAnalyses = @()
  $glossTokens = @()
  $normalizedTokens = @()

  foreach ($token in $tokens) {
    if ($token -notmatch "[A-Za-z']") {
      $glossTokens += $token
      continue
    }

    $analysis = Analyze-AncientTokenApi $context $token
    $wordAnalyses += $analysis
    $glossTokens += $analysis.morphemeGloss
    $normalizedParts = if ($analysis.components.Count) { @($analysis.components) } else { @($analysis.headword) }
    $normalizedTokens += ,$normalizedParts
  }

  $components = @($wordAnalyses | ForEach-Object {
    if ($_.components.Count) { $_.components } else { Normalize-AncientKey $_.headword }
  })
  $heads = @($wordAnalyses | ForEach-Object { Normalize-AncientKey $_.headword })
  $resolvedWords = @($wordAnalyses | ForEach-Object {
    if ($_.resolvedGloss) {
      $_.resolvedGloss
    } elseif ($_.literalGloss) {
      $_.literalGloss
    } else {
      $_.primaryGloss
    }
  })
  $literal = if ($components.Count) { Build-LiteralLineApi $context $wordAnalyses } else { "" }
  $idiomatic = Get-NarrativeOverride $context $lineText $heads $components
  if (-not $idiomatic) {
    $idiomatic = Invoke-SyntaxPattern $context $resolvedWords $heads $components
  }
  if (-not $idiomatic) {
    $idiomatic = ((@($resolvedWords | Where-Object { $_ }) -join " ").Trim())
    if ($idiomatic -and $idiomatic -notmatch "[.!?]$") {
      $idiomatic += "."
    }
    if ($idiomatic) {
      $idiomatic = Capitalize-Text $idiomatic
    }
  }

  return [ordered]@{
    text = $lineText
    tokens = $wordAnalyses
    normalizedTokens = $normalizedTokens
    morphemeGloss = Join-TranslatorTokens $glossTokens
    literal = $literal
    idiomatic = $idiomatic
  }
}

function Analyze-AncientTextApi($context, $text) {
  $lines = Split-TranslatorLines $text
  $lineAnalyses = @()
  foreach ($line in $lines) {
    $lineAnalyses += (Analyze-AncientLineApi $context $line.text)
  }

  $analyses = @($lineAnalyses | ForEach-Object { $_.tokens })
  return [ordered]@{
    lines = $lineAnalyses
    analyses = $analyses
    naturalGloss = Join-TranslatorLines (@($lineAnalyses | ForEach-Object { $_.morphemeGloss })) $lines
    literalTranslation = Join-TranslatorLines (@($lineAnalyses | ForEach-Object { $_.literal })) $lines
    idiomaticTranslation = Join-TranslatorLines (@($lineAnalyses | ForEach-Object { $_.idiomatic })) $lines
    knownCount = @($analyses | Where-Object { -not $_.isUnknown }).Count
    totalCount = $analyses.Count
    inferredCount = @($analyses | Where-Object { $_.status -eq "inferred" }).Count
    rescuedCount = @($analyses | Where-Object { @($_.path) -contains "normalized" }).Count
  }
}

function Handle-TranslationRequest($context) {
  $body = Read-RequestBody $context.Request
  $request = $body | ConvertFrom-Json
  $translationContext = New-TranslationContext ([bool]$request.includeInferred)
  $action = [string]$request.action
  $text = [string]$request.text

  if ($action -eq "english-to-ancient") {
    Write-JsonResponse $context 200 ([ordered]@{
      action = $action
      translation = Translate-EnglishToAncientApi $translationContext $text
    })
    return
  }

  if ($action -eq "analyze-ancient") {
    Write-JsonResponse $context 200 ([ordered]@{
      action = $action
      analysis = Analyze-AncientTextApi $translationContext $text
    })
    return
  }

  Write-Response $context 400 "Unsupported translation action."
}

function Get-LanguagePackStatus() {
  try {
    $lexiconPayload = Read-LexiconPayload
    $rulesConfig = Read-RulesConfig
    $language = Get-LanguageMetadata $rulesConfig
    $validation = Get-LanguagePackValidation $lexiconPayload $rulesConfig

    return [ordered]@{
      language = $language
      validation = $validation
      activePaths = [ordered]@{
        lexicon = $lexiconPath
        rulesConfig = $rulesConfigPath
        rulesNotes = $rulesPath
      }
    }
  } catch {
    return [ordered]@{
      language = [ordered]@{
        name = "Translator language"
        version = "0.0.0"
        description = ""
      }
      validation = [ordered]@{
        valid = $false
        errors = @(
          [ordered]@{
            severity = "error"
            message = $_.Exception.Message
          }
        )
        warnings = @()
        issues = @(
          [ordered]@{
            severity = "error"
            message = $_.Exception.Message
          }
        )
      }
      activePaths = [ordered]@{
        lexicon = $lexiconPath
        rulesConfig = $rulesConfigPath
        rulesNotes = $rulesPath
      }
    }
  }
}

function Get-LexiconCategoriesForMarkdown($entry) {
  $categories = New-Object System.Collections.Generic.HashSet[string] ([System.StringComparer]::OrdinalIgnoreCase)

  foreach ($category in (ConvertTo-ArrayValue $entry.partOfSpeech)) {
    if ($category) {
      [void]$categories.Add([string]$category)
    }
  }

  if ($entry.lexicalized) {
    [void]$categories.Add("lexicalized")
  }

  if ((ConvertTo-ArrayValue $entry.components).Count) {
    [void]$categories.Add("compound")
  }

  if (-not $categories.Count) {
    [void]$categories.Add("root")
  }

  return @($categories)
}

function Escape-MarkdownCell($value) {
  $safeValue = if ($null -eq $value) { "" } else { [string]$value }
  return $safeValue -replace "\|", "\\|"
}

function Format-MeaningCellForMarkdown($entry) {
  $meaning = Escape-MarkdownCell ((ConvertTo-ArrayValue $entry.meanings) -join ", ")
  $extras = New-Object System.Collections.Generic.List[string]

  $components = ConvertTo-ArrayValue $entry.components
  if ($components.Count) {
    [void]$extras.Add(("components: {0}" -f (($components | ForEach-Object { "`"$(Escape-MarkdownCell $_)`"" }) -join " + ")))
  }

  $etymology = ConvertTo-ArrayValue $entry.etymology
  if ($etymology.Count) {
    [void]$extras.Add(("etymology: {0}" -f (($etymology | ForEach-Object { "`"$(Escape-MarkdownCell $_)`"" }) -join " + ")))
  }

  if (-not $extras.Count) {
    return $meaning
  }

  return "$meaning ($($extras -join '; '))"
}

function Get-MarkdownSettings($rulesConfig, $language) {
  $settings = Get-ConfigValue $rulesConfig "workspace.markdown" ([pscustomobject]@{})
  $sectionOrder = New-Object System.Collections.Generic.List[string]
  foreach ($sectionName in (ConvertTo-ArrayValue (Get-ConfigValue $settings "sectionOrder" @("Additional Entries")))) {
    if ($sectionName -is [System.Collections.IEnumerable] -and $sectionName -isnot [string]) {
      foreach ($nestedSectionName in @($sectionName)) {
        if (-not [string]::IsNullOrWhiteSpace([string]$nestedSectionName)) {
          [void]$sectionOrder.Add([string]$nestedSectionName)
        }
      }
      continue
    }

    if (-not [string]::IsNullOrWhiteSpace([string]$sectionName)) {
      [void]$sectionOrder.Add([string]$sectionName)
    }
  }

  $sectionOrder = @($sectionOrder.ToArray())
  if (-not $sectionOrder.Count) {
    $sectionOrder = @("Additional Entries")
  }

  $sectionMap = @{}
  foreach ($property in (Get-ConfigValue $settings "sections" ([pscustomobject]@{})).PSObject.Properties) {
    $normalizedEntries = New-Object System.Collections.Generic.List[string]
    foreach ($entryValue in (ConvertTo-ArrayValue $property.Value)) {
      if ($entryValue -is [System.Collections.IEnumerable] -and $entryValue -isnot [string]) {
        foreach ($nestedEntryValue in @($entryValue)) {
          $normalizedEntry = Normalize-AncientKey $nestedEntryValue
          if ($normalizedEntry) {
            [void]$normalizedEntries.Add($normalizedEntry)
          }
        }
        continue
      }

      $normalizedEntry = Normalize-AncientKey $entryValue
      if ($normalizedEntry) {
        [void]$normalizedEntries.Add($normalizedEntry)
      }
    }

    $sectionMap[$property.Name] = @($normalizedEntries.ToArray())
  }

  return [ordered]@{
    title = [string](Get-ConfigValue $settings "title" $language.name)
    overview = [string](Get-ConfigValue $settings "overview" ("This lexicon document was generated directly from the backend-managed {0} vocabulary." -f $language.name))
    sectionOrder = $sectionOrder
    sections = $sectionMap
    inferredSection = [string](Get-ConfigValue $settings "inferredSection" "Inferred Entries")
    compoundSection = [string](Get-ConfigValue $settings "compoundSection" "Compounds")
    additionalSection = [string](Get-ConfigValue $settings "additionalSection" "Additional Entries")
  }
}

function Classify-EntryForMarkdown($entry, $markdownSettings) {
  $ancient = Normalize-AncientKey $entry.ancient
  $sectionMap = if ($null -ne $markdownSettings.sections) { $markdownSettings.sections } else { @{} }

  foreach ($section in $markdownSettings.sectionOrder) {
    $sectionEntries = if ($sectionMap.ContainsKey($section)) {
      @($sectionMap[$section])
    } else {
      @()
    }

    if ($sectionEntries -contains $ancient) {
      return $section
    }
  }

  if ($entry.status -eq "inferred") {
    return $markdownSettings.inferredSection
  }

  $categories = Get-LexiconCategoriesForMarkdown $entry
  if ($categories -contains "compound") {
    return $markdownSettings.compoundSection
  }

  if ($categories.Count) {
    return [string]$categories[0]
  }

  return $markdownSettings.additionalSection
}

function Build-LexiconMarkdownServer($entries, $rulesMarkdown, $includeInferred, $language) {
  $rulesConfig = Read-RulesConfig
  $markdownSettings = Get-MarkdownSettings $rulesConfig $language
  $grouped = @{}
  foreach ($section in $markdownSettings.sectionOrder) {
    $grouped[$section] = @()
  }

  $sortedEntries = @($entries | Sort-Object { $_.ancient })
  foreach ($entry in $sortedEntries) {
    $section = [string](Classify-EntryForMarkdown $entry $markdownSettings)
    if ([string]::IsNullOrWhiteSpace($section)) {
      $section = $markdownSettings.additionalSection
    }

    if (-not $grouped.ContainsKey($section)) {
      $grouped[$section] = @()
    }

    $grouped[$section] = @($grouped[$section]) + @($entry)
  }

  $lines = New-Object System.Collections.Generic.List[string]
  $inferredCount = @($entries | Where-Object { $_.status -eq "inferred" }).Count
  $confirmedCount = $entries.Count - $inferredCount

  $languageName = if ($markdownSettings.title) { [string]$markdownSettings.title } else { [string]$language.name }

  [void]$lines.Add("# $languageName")
  [void]$lines.Add("")
  [void]$lines.Add("## Overview")
  [void]$lines.Add("")
  [void]$lines.Add($markdownSettings.overview)
  [void]$lines.Add("")
  [void]$lines.Add("- confirmed entries included: $confirmedCount")
  [void]$lines.Add("- inferred entries included: $inferredCount")
  [void]$lines.Add("- export mode included inferred entries: $(if ($includeInferred) { 'yes' } else { 'no' })")
  [void]$lines.Add("")
  [void]$lines.Add("---")
  [void]$lines.Add("")

  foreach ($section in $markdownSettings.sectionOrder) {
    $sectionEntries = if ($grouped.ContainsKey($section)) {
      @($grouped[$section])
    } else {
      @()
    }

    if (-not $sectionEntries.Count) {
      continue
    }

    [void]$lines.Add("## $section")
    [void]$lines.Add("")
    [void]$lines.Add("| Ancient | Meaning |")
    [void]$lines.Add("|---|---|")
    foreach ($entry in $sectionEntries) {
      [void]$lines.Add("| `"$(Escape-MarkdownCell $entry.ancient)`" | $(Format-MeaningCellForMarkdown $entry) |")
    }
    [void]$lines.Add("")
    [void]$lines.Add("---")
    [void]$lines.Add("")
  }

  [void]$lines.Add("## Export Notes")
  [void]$lines.Add("")
  [void]$lines.Add("- Entries are grouped automatically from the active backend lexicon.")
  [void]$lines.Add("- Meanings are taken directly from the current backend-managed vocabulary.")
  [void]$lines.Add("- When inferred mode is disabled, inferred entries are omitted from the export.")
  [void]$lines.Add("")

  if (-not [string]::IsNullOrWhiteSpace($rulesMarkdown)) {
    [void]$lines.Add("---")
    [void]$lines.Add("")
    [void]$lines.Add($rulesMarkdown.Trim())
    [void]$lines.Add("")
  }

  return ($lines -join "`n")
}

function Handle-MarkdownExportRequest($context) {
  $body = Read-RequestBody $context.Request
  $request = if ([string]::IsNullOrWhiteSpace($body)) { [pscustomobject]@{} } else { $body | ConvertFrom-Json }
  $includeInferred = [bool]$request.includeInferred
  $lexiconPayload = Read-LexiconPayload
  $rulesConfig = Read-RulesConfig
  $language = Get-LanguageMetadata $rulesConfig
  $entries = @(
    Normalize-LexiconEntries $lexiconPayload.confirmed
  )
  if ($includeInferred) {
    $entries += @(Normalize-LexiconEntries $lexiconPayload.inferred)
  }

  $rulesMarkdown = if (Test-Path -LiteralPath $rulesPath -PathType Leaf) {
    Get-Content -LiteralPath $rulesPath -Raw -Encoding UTF8
  } else {
    ""
  }

  $markdown = Build-LexiconMarkdownServer $entries $rulesMarkdown $includeInferred $language
  Write-Response $context 200 $markdown "text/markdown; charset=utf-8"
}

function Handle-ApiRequest($context) {
  $path = $context.Request.Url.AbsolutePath.TrimEnd("/")
  if ([string]::IsNullOrWhiteSpace($path)) {
    $path = "/"
  }

  if ($path -eq "/api/health") {
    $packStatus = Get-LanguagePackStatus
    Write-JsonResponse $context 200 ([ordered]@{
      status = $(if ($packStatus.validation.valid) { "ok" } else { "degraded" })
      language = $packStatus.language
      activePaths = $packStatus.activePaths
      validation = $packStatus.validation
      translationApi = [bool]$packStatus.validation.valid
      lexiconApi = $true
      rulesConfigApi = $true
      rulesNotesApi = $true
      markdownExportApi = $true
    })
    return $true
  }

  if ($path -eq "/api/language-pack") {
    if ($context.Request.HttpMethod -eq "GET") {
      Write-JsonResponse $context 200 (Get-LanguagePackStatus)
      return $true
    }

    Write-Response $context 405 "Method Not Allowed"
    return $true
  }

  if ($path -eq "/api/translate") {
    if ($context.Request.HttpMethod -eq "POST") {
      Handle-TranslationRequest $context
      return $true
    }

    Write-Response $context 405 "Method Not Allowed"
    return $true
  }

  if ($path -eq "/api/export-markdown") {
    if ($context.Request.HttpMethod -eq "POST") {
      Handle-MarkdownExportRequest $context
      return $true
    }

    Write-Response $context 405 "Method Not Allowed"
    return $true
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

  if ($path -eq "/api/rules-config") {
    if ($context.Request.HttpMethod -eq "GET") {
      Write-JsonResponse $context 200 (Read-RulesConfig)
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

$autoOpenBrowser = $env:TRANSLATOR_NO_OPEN -notin @("1", "true", "TRUE", "yes", "YES")
if ($autoOpenBrowser) {
  Start-Process $indexUrl | Out-Null
}
$activeLanguage = Get-LanguageMetadata (Read-RulesConfig)
Write-Host "$($activeLanguage.name) translator is running at $indexUrl" -ForegroundColor Green
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
      $message = $_.Exception.Message
      if ([string]::IsNullOrWhiteSpace($message)) {
        $message = "Unknown server error."
      }
      Write-Response $context 500 "Internal Server Error: $message"
    }
  }
} finally {
  $listener.Stop()
  $listener.Close()
}




