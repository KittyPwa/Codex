$ErrorActionPreference = "Stop"

$root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$preferredPorts = @(4173, 4174, 4175, 4176, 4177, 4178, 4179, 4180)
$lexiconPath = Join-Path $root "data\\lexicon.json"
$rulesPath = Join-Path $root "data\\rules-notes.md"
$rulesConfigPath = Join-Path $root "data\\rules.json"

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

function ConvertTo-ArrayValue($value) {
  if ($null -eq $value) {
    return @()
  }

  if ($value -is [string]) {
    return @($value)
  }

  if ($value -is [System.Collections.IEnumerable]) {
    return @($value)
  }

  return @($value)
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
    Lexicon = $lexiconPayload
    Rules = $rulesConfig
    Entries = $entries
    EntryMap = $entryMap
    EnglishMap = $englishMap
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

function Find-PoeticEnglishOverride($text) {
  $map = @{
    "bring ruin, bring ruin" = "Tso'koa, Tso'koa"
    "our lives are yours" = "Neali micht tealeh"
    "we give you our future" = "Neali tso nach tealeh"
    "your winds blind all" = "Teeleh sesh vata kol"
    "do not harm our flesh" = "Val rel kesheh"
    "bring to new lands" = "Tso teal's tsol nali"
    "ruin, harm, peace" = "Koa's - rel's - tsecht's"
    "we are your children" = "Neali yeketeh"
    "give us peace" = "Tso neali tsacht"
  }

  $normalized = Normalize-EnglishKey $text
  if ($map.ContainsKey($normalized)) {
    return $map[$normalized]
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

    $override = Find-PoeticEnglishOverride $line.text
    if ($override) {
      $translated += $override
      continue
    }

    $tokens = Tokenize-TranslatorText $line.text
    $output = New-Object System.Collections.Generic.List[string]
    $index = 0

    while ($index -lt $tokens.Count) {
      $token = $tokens[$index]

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

      if ($fillers.Contains($token.ToLowerInvariant())) {
        $index += 1
        continue
      }

      [void]$output.Add("[$($token.ToLowerInvariant())]")
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
      literalGloss = $primaryGloss
      narrativeGloss = $primaryGloss
      resolvedGloss = $(if (Get-PhraseRendering $context $componentPath) { Get-PhraseRendering $context $componentPath } elseif (Get-LexicalCollapse $context $componentPath) { Get-LexicalCollapse $context $componentPath } else { $primaryGloss })
      components = @($components)
      etymology = @(ConvertTo-ArrayValue $entry.etymology)
      notes = @(ConvertTo-ArrayValue $entry.notes)
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
      literalGloss = $(if ($lexicalCollapse) { $lexicalCollapse } else { ($resolved | ForEach-Object { $_.meanings[0] }) -join " + " })
      narrativeGloss = $(if ($lexicalCollapse) { $lexicalCollapse } else { ($resolved | ForEach-Object { $_.meanings[0] }) -join " + " })
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
      literalGloss = $(if ($lexicalCollapse) { $lexicalCollapse } else { ($resolved | ForEach-Object { $_.meanings[0] }) -join " + " })
      narrativeGloss = $(if ($lexicalCollapse) { $lexicalCollapse } else { ($resolved | ForEach-Object { $_.meanings[0] }) -join " + " })
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
    if ((ConvertTo-ArrayValue $pattern.heads) -join "|" -eq ($heads -join "|")) {
      return [string]$pattern.output
    }
  }

  foreach ($pattern in (ConvertTo-ArrayValue (Get-ConfigValue $context.Rules "translation.componentSequenceOverrides" @()))) {
    if ((ConvertTo-ArrayValue $pattern.components) -join "|" -eq ($components -join "|")) {
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

function Resolve-LocationText($context, $heads, $tailWords) {
  foreach ($pattern in (ConvertTo-ArrayValue (Get-ConfigValue $context.Rules "translation.tailRenderings" @()))) {
    $includes = ConvertTo-ArrayValue $pattern.includes
    if ($includes.Count -and ($includes | Where-Object { $heads -contains $_ }).Count -eq $includes.Count) {
      return [string]$pattern.output
    }
  }

  return (@($tailWords) -join " ")
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
  $literal = if ($components.Count) {
    if (Get-PhraseRendering $context $components) {
      Get-PhraseRendering $context $components
    } elseif (Get-LexicalCollapse $context $components) {
      Get-LexicalCollapse $context $components
    } else {
      (($resolvedWords | Where-Object { $_ }) -join " ")
    }
  } else {
    ""
  }
  $idiomatic = Get-NarrativeOverride $context $lineText $heads $components
  if (-not $idiomatic -and $heads.Count -ge 2 -and $heads[0] -eq "lan") {
    $subject = Resolve-SubjectText $context $resolvedWords[1]
    $tail = if ($resolvedWords.Count -gt 2) { Resolve-LocationText $context (@($heads | Select-Object -Skip 2)) (@($resolvedWords | Select-Object -Skip 2)) } else { "" }
    $idiomatic = ("{0} appeared{1}" -f ($subject.Substring(0,1).ToUpper() + $subject.Substring(1)), $(if ($tail) { " $tail." } else { "." }))
  }
  if (-not $idiomatic -and $heads.Count -eq 2 -and $heads[1] -eq "licht") {
    $subject = Resolve-SubjectText $context $resolvedWords[0]
    $idiomatic = "$([char]::ToUpper($subject[0]) + $subject.Substring(1)) remained."
  }
  if (-not $idiomatic -and $heads.Count -ge 2 -and $heads[1] -eq "sal") {
    $subject = Resolve-SubjectText $context $resolvedWords[0]
    $tail = if ($resolvedWords.Count -gt 2) { Resolve-LocationText $context (@($heads | Select-Object -Skip 2)) (@($resolvedWords | Select-Object -Skip 2)) } else { "" }
    $idiomatic = ("{0} came{1}" -f ($subject.Substring(0,1).ToUpper() + $subject.Substring(1)), $(if ($tail) { " $tail." } else { "." }))
  }
  if (-not $idiomatic -and $heads.Count -ge 3 -and $heads[1] -eq "sacht") {
    $subject = Resolve-SubjectText $context $resolvedWords[0]
    $tail = Resolve-LocationText $context (@($heads | Select-Object -Skip 2)) (@($resolvedWords | Select-Object -Skip 2))
    $idiomatic = "$([char]::ToUpper($subject[0]) + $subject.Substring(1)) continued $tail."
  }
  if (-not $idiomatic -and $heads.Count -ge 3 -and $heads[1] -eq "ru") {
    $subject = Resolve-SubjectText $context $resolvedWords[0]
    $idiomatic = "$([char]::ToUpper($subject[0]) + $subject.Substring(1)) knew $(@($resolvedWords | Select-Object -Skip 2) -join ' ')."
  }
  if (-not $idiomatic) {
    $idiomatic = ((@($resolvedWords) -join " ").Trim())
    if ($idiomatic -and $idiomatic -notmatch "[.!?]$") {
      $idiomatic += "."
    }
    if ($idiomatic) {
      $idiomatic = $idiomatic.Substring(0,1).ToUpper() + $idiomatic.Substring(1)
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

function Handle-ApiRequest($context) {
  $path = $context.Request.Url.AbsolutePath.TrimEnd("/")
  if ([string]::IsNullOrWhiteSpace($path)) {
    $path = "/"
  }

  if ($path -eq "/api/health") {
    Write-JsonResponse $context 200 ([ordered]@{
      status = "ok"
      translationApi = $true
      lexiconApi = $true
      rulesNotesApi = $true
    })
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




