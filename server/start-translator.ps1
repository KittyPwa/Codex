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

$defaultLanguagePackRoot = Resolve-ProjectDataPath $env:TRANSLATOR_LANGUAGE_DIR "data"
$languagePacksRoot = Join-Path $root "data\packs"
$languagePackRoot = $defaultLanguagePackRoot
$lexiconPath = Resolve-ProjectDataPath $env:TRANSLATOR_LEXICON_PATH (Join-Path $languagePackRoot "lexicon.json")
$rulesPath = Resolve-ProjectDataPath $env:TRANSLATOR_RULES_NOTES_PATH (Join-Path $languagePackRoot "rules-notes.md")
$rulesConfigPath = Resolve-ProjectDataPath $env:TRANSLATOR_RULES_CONFIG_PATH (Join-Path $languagePackRoot "rules.json")
$languagePackSchemaPath = Resolve-ProjectDataPath $env:TRANSLATOR_LANGUAGE_SCHEMA_PATH (Join-Path $languagePackRoot "language-pack.schema.json")
$script:activeLanguagePackId = "default"
$script:availableLanguagePacks = @{}

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

function New-LanguagePackDescriptor($id, $packRoot, $label = $null) {
  $resolvedRoot = [System.IO.Path]::GetFullPath($packRoot)
  $packId = if ([string]::IsNullOrWhiteSpace($id)) { "default" } else { [string]$id }
  $packLabel = if ([string]::IsNullOrWhiteSpace($label)) { $packId } else { [string]$label }

  return [ordered]@{
    id = $packId
    label = $packLabel
    root = $resolvedRoot
    lexicon = Join-Path $resolvedRoot "lexicon.json"
    rulesConfig = Join-Path $resolvedRoot "rules.json"
    rulesNotes = Join-Path $resolvedRoot "rules-notes.md"
    schema = Join-Path $resolvedRoot "language-pack.schema.json"
  }
}

function Test-LanguagePackDescriptor($descriptor) {
  return (
    (Test-Path -LiteralPath $descriptor.root -PathType Container) -and
    (Test-Path -LiteralPath $descriptor.lexicon -PathType Leaf) -and
    (Test-Path -LiteralPath $descriptor.rulesConfig -PathType Leaf)
  )
}

function Read-LanguagePackMetadataFromDescriptor($descriptor) {
  if (-not (Test-Path -LiteralPath $descriptor.rulesConfig -PathType Leaf)) {
    return [ordered]@{
      name = $descriptor.label
      version = "0.0.0"
      description = ""
    }
  }

  try {
    $raw = Get-Content -LiteralPath $descriptor.rulesConfig -Raw -Encoding UTF8
    if ([string]::IsNullOrWhiteSpace($raw)) {
      throw "Empty rules config."
    }

    $parsed = $raw | ConvertFrom-Json
    return [ordered]@{
      name = [string](Get-ConfigValue $parsed "language.name" $descriptor.label)
      version = [string](Get-ConfigValue $parsed "language.version" "0.0.0")
      description = [string](Get-ConfigValue $parsed "language.description" "")
    }
  } catch {
    return [ordered]@{
      name = $descriptor.label
      version = "0.0.0"
      description = ""
    }
  }
}

function Get-AvailableLanguagePackDescriptors() {
  $packs = @{}
  $packs["default"] = New-LanguagePackDescriptor "default" $defaultLanguagePackRoot "Default"

  if (Test-Path -LiteralPath $languagePacksRoot -PathType Container) {
    foreach ($directory in (Get-ChildItem -LiteralPath $languagePacksRoot -Directory | Sort-Object Name)) {
      $descriptor = New-LanguagePackDescriptor $directory.Name $directory.FullName $directory.Name
      if (Test-LanguagePackDescriptor $descriptor) {
        $packs[$descriptor.id] = $descriptor
      }
    }
  }

  return $packs
}

function Get-CanonicalLanguagePackSchemaSourcePath() {
  $preferred = Join-Path $root "data\language-pack.schema.json"
  if (Test-Path -LiteralPath $preferred -PathType Leaf) {
    return [System.IO.Path]::GetFullPath($preferred)
  }

  if (Test-Path -LiteralPath $languagePackSchemaPath -PathType Leaf) {
    return [System.IO.Path]::GetFullPath($languagePackSchemaPath)
  }

  throw "Could not locate a source language-pack.schema.json file."
}

function ConvertTo-PackSlug($value) {
  $candidate = [string]$value
  $candidate = $candidate.ToLowerInvariant()
  $candidate = [System.Text.RegularExpressions.Regex]::Replace($candidate, "[^a-z0-9]+", "-")
  $candidate = $candidate.Trim("-")
  return $candidate
}

function New-StarterLanguagePackLexicon() {
  return [ordered]@{
    confirmed = @()
    inferred = @()
  }
}

function New-StarterLanguagePackRules($packId, $languageName, $version, $description) {
  $safeLanguageName = if ([string]::IsNullOrWhiteSpace($languageName)) { $packId } else { [string]$languageName }
  $safeVersion = if ([string]::IsNullOrWhiteSpace($version)) { "0.1.0" } else { [string]$version }
  $safeDescription = [string]$description

  return [ordered]@{
    language = [ordered]@{
      name = $safeLanguageName
      version = $safeVersion
      description = $safeDescription
    }
    text = [ordered]@{
      tokenPattern = "[A-Za-z']+|\r\n|\r|\n|[ \t]+|[^\sA-Za-z']"
      wordCharacterPattern = "[A-Za-z']"
      lineSplitPattern = "(\r\n|\r|\n)"
      join = [ordered]@{
        space = " "
        noSpaceAfterPattern = '[\(\[\{\/"''-]$'
        noSpaceBeforePattern = '^[\)\]\},.!?:;"'']'
      }
    }
    analysis = [ordered]@{
      recoveryOrder = @("direct", "normalization", "segmentation")
      compat = [ordered]@{
        allowLegacyProductiveSuffixFallback = $false
      }
      directLookup = "simple"
      synthesis = [ordered]@{
        joiner = " + "
      }
      projections = [ordered]@{
        headSource = "headword"
        componentSource = "componentsOrHeadword"
        normalizedTokenSource = "componentsOrHeadword"
      }
      unknown = [ordered]@{
        format = "[{token}]"
        note = "No direct or configured recovery succeeded."
        status = "unknown"
        register = "source"
        path = @("unknown")
      }
      normalization = [ordered]@{
        missingPartPolicy = "unknown"
        note = "Recovered through configured normalization."
        status = "inferred"
        register = "source"
      }
      segmentation = [ordered]@{
        missingPartPolicy = "unknown"
      }
    }
    lexicon = [ordered]@{
      fieldMap = [ordered]@{
        headword = "ancient"
        meanings = "meanings"
        status = "status"
        register = "register"
        components = "components"
        etymology = "etymology"
        notes = "notes"
        pronunciation = "pronunciation"
        lexicalized = "lexicalized"
        allowNominalReading = "allowNominalReading"
        partOfSpeech = "partOfSpeech"
      }
    }
    workspace = [ordered]@{
      markdown = [ordered]@{
        title = $safeLanguageName
        overview = "This lexicon document was generated from the active $safeLanguageName language pack."
        sectionOrder = @("Core Vocabulary", "Additional Entries")
        sections = [ordered]@{
          "Core Vocabulary" = @()
        }
        inferredSection = "Inferred Entries"
        compoundSection = "Compounds"
        additionalSection = "Additional Entries"
      }
    }
    english = [ordered]@{
      fillers = @("the", "a", "an")
      aliases = [ordered]@{}
    }
    normalization = [ordered]@{}
    morphology = [ordered]@{
      segmenters = @()
      productiveSuffixes = @()
      affixMeanings = [ordered]@{}
      hiddenTranslationMarkers = @()
    }
    composition = [ordered]@{
      strategyMap = [ordered]@{
        phrase = "phrase"
        lexical = "lexical"
        contextual = "contextual"
        joined = "joined"
        primary = "primary"
      }
      strategies = [ordered]@{}
      resolution = [ordered]@{
        directOrder = @("phrase", "lexical", "primary")
        normalizedOrder = @("phrase", "lexical", "contextual", "joined")
        segmentedOrder = @("phrase", "lexical", "joined")
      }
      lexicalCompounds = [ordered]@{}
      phraseRenderings = [ordered]@{}
      contextualRenderings = [ordered]@{}
    }
    translation = [ordered]@{
      fallback = [ordered]@{
        idiomaticSource = "resolvedWords"
        idiomaticTemplate = "{words}"
        idiomaticJoiner = " "
        idiomaticPunctuation = "."
        capitalizeIdiomatic = $true
        literalSource = "resolvedGloss"
      }
      glossSelection = [ordered]@{
        primaryPath = "meanings.0"
        literalPath = "renderings.literal"
        narrativePath = "renderings.narrative"
        narrativeNominalPath = "meanings.1"
        fallbackPath = "ancient"
      }
      englishToAncientOverrides = [ordered]@{}
      narrativeRenderings = [ordered]@{}
      defaultResolvers = [ordered]@{
        subject = [ordered]@{
          type = "phrase"
          source = "resolvedWords"
          selection = "index"
          defaultIndex = 0
          articleMap = [ordered]@{}
          articlePrefix = " "
        }
      }
      segmentResolvers = [ordered]@{
        verb = [ordered]@{
          type = "head"
          source = "heads"
          selection = "index"
          defaultIndex = 0
          glossMode = "narrative"
        }
        raw = [ordered]@{
          type = "phrase"
          source = "resolvedWords"
          selection = "range"
          defaultStart = 0
        }
      }
      syntaxPatterns = @(
        [ordered]@{
          match = [ordered]@{
            minHeads = 2
          }
          template = "{actor} {action}."
          segments = [ordered]@{
            actor = [ordered]@{
              index = 0
              resolver = "subject"
            }
            action = [ordered]@{
              index = 1
              resolver = "verb"
            }
          }
        }
      )
      nounArticles = [ordered]@{}
      objectArticles = [ordered]@{}
      subjectRenderings = [ordered]@{}
      articleBlockers = @()
      articleExceptions = @()
      bareWords = @()
      poeticOverrides = [ordered]@{}
      headSequenceOverrides = @()
      componentSequenceOverrides = @()
      tailRenderings = @()
      continuationRenderings = @()
      locationReorderings = @()
    }
    phonology = [ordered]@{
      preferredClusters = @()
    }
  }
}

function New-StarterLanguagePackRulesNotes($packId, $languageName) {
  $safeLanguageName = if ([string]::IsNullOrWhiteSpace($languageName)) { $packId } else { [string]$languageName }
  return @"
# $safeLanguageName Rules & Notes

## Language Snapshot

- Pack id: `$packId`
- Language name: $safeLanguageName
- Purpose: Replace these starter notes with the actual grammar of your language.

## Sound And Writing

- Alphabet / script:
- Pronunciation notes:
- Capitalization:
- Apostrophes, hyphens, or separators:

## Word Classes

- Nouns:
- Verbs:
- Adjectives:
- Particles:
- Pronouns:

## Morphology

- Productive affixes:
- How compounds are formed:
- When a form is lexicalized:
- Irregular forms:

## Syntax

- Basic clause order:
- Noun phrase order:
- Where modifiers go:
- How possession works:
- How location works:

## Translation Guidance

- Default idiomatic sentence style:
- Narrative tense handling:
- Articles or article-like behavior:
- Poetic / ritual exceptions:

## Open Questions

- Add unresolved grammar questions here.
"@
}

function New-LanguagePackScaffold($request) {
  $requestedId = [string](Get-ConfigValue $request "packId" "")
  $languageName = [string](Get-ConfigValue $request "languageName" "")
  $version = [string](Get-ConfigValue $request "version" "0.1.0")
  $description = [string](Get-ConfigValue $request "description" "")
  $makeActive = [bool](Get-ConfigValue $request "makeActive" $true)

  $packId = ConvertTo-PackSlug $(if ($requestedId) { $requestedId } else { $languageName })
  if ([string]::IsNullOrWhiteSpace($packId)) {
    throw "Pack id must include at least one letter or number."
  }

  if ($packId -eq "default") {
    throw "The pack id 'default' is reserved."
  }

  if ([string]::IsNullOrWhiteSpace($languageName)) {
    throw "Language name is required."
  }

  $targetRoot = Join-Path $languagePacksRoot $packId
  $descriptor = New-LanguagePackDescriptor $packId $targetRoot $languageName
  if (Test-Path -LiteralPath $descriptor.root) {
    throw "A language pack named '$packId' already exists."
  }

  [System.IO.Directory]::CreateDirectory($descriptor.root) | Out-Null

  try {
    $schemaSourcePath = Get-CanonicalLanguagePackSchemaSourcePath
    [System.IO.File]::Copy($schemaSourcePath, $descriptor.schema, $false)

    $lexiconJson = (New-StarterLanguagePackLexicon) | ConvertTo-Json -Depth 16
    [System.IO.File]::WriteAllText($descriptor.lexicon, $lexiconJson, [System.Text.UTF8Encoding]::new($false))

    $rulesJson = (New-StarterLanguagePackRules $packId $languageName $version $description) | ConvertTo-Json -Depth 32
    [System.IO.File]::WriteAllText($descriptor.rulesConfig, $rulesJson, [System.Text.UTF8Encoding]::new($false))

    $rulesNotes = New-StarterLanguagePackRulesNotes $packId $languageName
    [System.IO.File]::WriteAllText($descriptor.rulesNotes, $rulesNotes, [System.Text.UTF8Encoding]::new($false))
  } catch {
    if (Test-Path -LiteralPath $descriptor.root -PathType Container) {
      Remove-Item -LiteralPath $descriptor.root -Recurse -Force
    }
    throw
  }

  $script:availableLanguagePacks = Get-AvailableLanguagePackDescriptors
  if ($makeActive) {
    return Set-ActiveLanguagePackById $packId
  }

  return [ordered]@{
    created = $true
    packId = $packId
    language = Read-LanguagePackMetadataFromDescriptor $descriptor
    active = $false
    activePaths = [ordered]@{
      lexicon = $descriptor.lexicon
      rulesConfig = $descriptor.rulesConfig
      rulesNotes = $descriptor.rulesNotes
      schema = $descriptor.schema
    }
  }
}

function Set-ActiveLanguagePackDescriptor($descriptor) {
  $script:activeLanguagePackId = [string]$descriptor.id
  $script:languagePackRoot = [string]$descriptor.root
  $script:lexiconPath = [string]$descriptor.lexicon
  $script:rulesConfigPath = [string]$descriptor.rulesConfig
  $script:rulesPath = [string]$descriptor.rulesNotes
  $script:languagePackSchemaPath = [string]$descriptor.schema
}

function Initialize-LanguagePackRegistry() {
  $script:availableLanguagePacks = Get-AvailableLanguagePackDescriptors
  if (-not $script:availableLanguagePacks.ContainsKey($script:activeLanguagePackId)) {
    $script:activeLanguagePackId = "default"
  }

  Set-ActiveLanguagePackDescriptor $script:availableLanguagePacks[$script:activeLanguagePackId]
}

function Get-ActiveLanguagePackDescriptor() {
  if (-not $script:availableLanguagePacks.Count) {
    Initialize-LanguagePackRegistry
  }

  if ($script:availableLanguagePacks.ContainsKey($script:activeLanguagePackId)) {
    return $script:availableLanguagePacks[$script:activeLanguagePackId]
  }

  return New-LanguagePackDescriptor $script:activeLanguagePackId $languagePackRoot $script:activeLanguagePackId
}

function Set-ActiveLanguagePackById($packId) {
  $script:availableLanguagePacks = Get-AvailableLanguagePackDescriptors

  $resolvedId = [string]$packId
  if (-not $script:availableLanguagePacks.ContainsKey($resolvedId)) {
    throw "Unknown language pack '$resolvedId'."
  }

  $previous = Get-ActiveLanguagePackDescriptor
  $target = $script:availableLanguagePacks[$resolvedId]
  Set-ActiveLanguagePackDescriptor $target

  try {
    $lexiconPayload = Read-LexiconPayload
    $rulesConfig = Read-RulesConfig
    $validation = Get-LanguagePackValidation $lexiconPayload $rulesConfig
    if (-not $validation.valid) {
      $messages = @($validation.errors | ForEach-Object { $_.message })
      throw ("Invalid language pack: {0}" -f ($messages -join " "))
    }
  } catch {
    Set-ActiveLanguagePackDescriptor $previous
    throw
  }

  return Get-LanguagePackStatus
}

function Get-LanguagePackRegistryReport() {
  $script:availableLanguagePacks = Get-AvailableLanguagePackDescriptors

  $packs = foreach ($descriptor in ($script:availableLanguagePacks.Values | Sort-Object id)) {
    $metadata = Read-LanguagePackMetadataFromDescriptor $descriptor
    [ordered]@{
      id = $descriptor.id
      label = $descriptor.label
      active = ($descriptor.id -eq $script:activeLanguagePackId)
      language = $metadata
      root = $descriptor.root
      activePaths = [ordered]@{
        lexicon = $descriptor.lexicon
        rulesConfig = $descriptor.rulesConfig
        rulesNotes = $descriptor.rulesNotes
        schema = $descriptor.schema
      }
    }
  }

  return [ordered]@{
    activePackId = $script:activeLanguagePackId
    packs = @($packs)
  }
}

function Get-RawLexiconEntries($value) {
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

function Get-LexiconFieldMap($rulesConfig) {
  $defaults = [ordered]@{
    headword = "ancient"
    meanings = "meanings"
    status = "status"
    register = "register"
    components = "components"
    etymology = "etymology"
    notes = "notes"
    pronunciation = "pronunciation"
    lexicalized = "lexicalized"
    allowNominalReading = "allowNominalReading"
    partOfSpeech = "partOfSpeech"
  }

  $configured = Get-ConfigValue $rulesConfig "lexicon.fieldMap" ([pscustomobject]@{})
  $fieldMap = [ordered]@{}
  foreach ($key in @($defaults.Keys)) {
    $configuredValue = [string](Get-ConfigValue $configured $key "")
    $fieldMap[$key] = if ([string]::IsNullOrWhiteSpace($configuredValue)) {
      $defaults[$key]
    } else {
      $configuredValue
    }
  }

  return [pscustomobject]$fieldMap
}

function Get-LexiconEntryValue($entry, $fieldMap, $fieldName, $default = $null) {
  $fieldPath = [string](Get-ConfigValue $fieldMap $fieldName "")
  if ([string]::IsNullOrWhiteSpace($fieldPath)) {
    return $default
  }

  $value = Get-ConfigValue $entry $fieldPath $default
  if (
    $value -is [System.Collections.IEnumerable] -and
    $value -isnot [string] -and
    $value -isnot [System.Collections.IDictionary]
  ) {
    $items = @($value)
    if (
      $items.Count -eq 1 -and
      $items[0] -is [System.Collections.IEnumerable] -and
      $items[0] -isnot [string] -and
      $items[0] -isnot [System.Collections.IDictionary]
    ) {
      return @($items[0])
    }
  }

  return $value
}

function Get-LexiconEntryArrayValue($entry, $fieldMap, $fieldName) {
  $value = Get-LexiconEntryValue $entry $fieldMap $fieldName $null
  if ($null -eq $value) {
    return @()
  }

  if ($value -is [string]) {
    return @($value)
  }

  if ($value -is [System.Collections.IEnumerable] -and $value -isnot [System.Collections.IDictionary]) {
    return @($value)
  }

  return @($value)
}

function Normalize-LexiconEntry($entry, $fieldMap, $defaultStatus = "confirmed", $defaultRegister = "source") {
  if ($null -eq $entry) {
    return $null
  }

  $headword = [string](Get-LexiconEntryValue $entry $fieldMap "headword" "")
  $meanings = Get-LexiconEntryArrayValue $entry $fieldMap "meanings"
  $status = [string](Get-LexiconEntryValue $entry $fieldMap "status" $defaultStatus)
  $register = [string](Get-LexiconEntryValue $entry $fieldMap "register" $defaultRegister)

  return [ordered]@{
    ancient = $headword
    meanings = @($meanings)
    status = if ($status) { $status } else { $defaultStatus }
    register = if ($register) { $register } else { $defaultRegister }
    components = @(Get-LexiconEntryArrayValue $entry $fieldMap "components")
    etymology = @(Get-LexiconEntryArrayValue $entry $fieldMap "etymology")
    notes = @(Get-LexiconEntryArrayValue $entry $fieldMap "notes")
    pronunciation = [string](Get-LexiconEntryValue $entry $fieldMap "pronunciation" "")
    lexicalized = [bool](Get-LexiconEntryValue $entry $fieldMap "lexicalized" $false)
    allowNominalReading = [bool](Get-LexiconEntryValue $entry $fieldMap "allowNominalReading" $false)
    partOfSpeech = @(Get-LexiconEntryArrayValue $entry $fieldMap "partOfSpeech")
    sourceEntry = $entry
  }
}

function Normalize-LexiconEntries($value, $fieldMap, $defaultStatus = "confirmed") {
  $entries = foreach ($entry in (Get-RawLexiconEntries $value)) {
    $normalized = Normalize-LexiconEntry $entry $fieldMap $defaultStatus
    if ($null -ne $normalized) {
      $normalized
    }
  }

  return @($entries)
}

function Read-LexiconPayload() {
  if (-not (Test-Path -LiteralPath $lexiconPath -PathType Leaf)) {
    throw "Missing lexicon.json."
  }

  $raw = Get-Content -LiteralPath $lexiconPath -Raw -Encoding UTF8
  $parsed = $raw | ConvertFrom-Json

  if ($parsed -is [System.Collections.IEnumerable] -and $parsed -isnot [string]) {
    return [ordered]@{
      confirmed = Get-RawLexiconEntries $parsed
      inferred = @()
    }
  }

  return [ordered]@{
    confirmed = Get-RawLexiconEntries $parsed.confirmed
    inferred = Get-RawLexiconEntries $parsed.inferred
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

function Get-RulesConfigReport() {
  return [ordered]@{
    config = Read-RulesConfig
    path = $rulesConfigPath
  }
}

function Read-LanguagePackSchema() {
  if (-not (Test-Path -LiteralPath $languagePackSchemaPath -PathType Leaf)) {
    return [pscustomobject]@{}
  }

  $raw = Get-Content -LiteralPath $languagePackSchemaPath -Raw -Encoding UTF8
  if ([string]::IsNullOrWhiteSpace($raw)) {
    return [pscustomobject]@{}
  }

  return $raw | ConvertFrom-Json
}

function Write-JsonDocument($path, $body) {
  $parsed = if ([string]::IsNullOrWhiteSpace($body)) {
    throw "JSON document body cannot be empty."
  } else {
    $body | ConvertFrom-Json
  }

  [System.IO.File]::WriteAllText($path, $body, [System.Text.UTF8Encoding]::new($false))
  return $parsed
}

function Get-ConfigValue($Object, $Path, $Default = $null) {
  $current = $Object
  foreach ($segment in ($Path -split "\.")) {
    if ($null -eq $current) {
      return $Default
    }

    if (
      $current -is [System.Collections.IEnumerable] -and
      $current -isnot [string] -and
      $current -isnot [System.Collections.IDictionary]
    ) {
      $items = @($current)
      $index = 0
      if (-not [int]::TryParse([string]$segment, [ref]$index)) {
        return $Default
      }

      if ($index -lt 0 -or $index -ge $items.Count) {
        return $Default
      }

      $current = $items[$index]
      continue
    }

    if ($current -is [System.Collections.IDictionary]) {
      if (-not $current.Contains($segment)) {
        return $Default
      }

      $current = $current[$segment]
      continue
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

  if ($current -is [System.Collections.IEnumerable] -and $current -isnot [string] -and $current -isnot [System.Collections.IDictionary]) {
    return ,@($current)
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

function Get-TextProcessingConfig($rulesConfig) {
  return [ordered]@{
    tokenPattern = [string](Get-ConfigValue $rulesConfig "text.tokenPattern" "[A-Za-z']+|\r\n|\r|\n|[ \t]+|[^\sA-Za-z']")
    apostrophePattern = [string](Get-ConfigValue $rulesConfig "text.wordCharacterPattern" "[A-Za-z']")
    joinSpace = [string](Get-ConfigValue $rulesConfig "text.join.space" " ")
    noSpaceAfterPattern = [string](Get-ConfigValue $rulesConfig "text.join.noSpaceAfterPattern" "[\(\[\{\/""'-]$")
    noSpaceBeforePattern = [string](Get-ConfigValue $rulesConfig "text.join.noSpaceBeforePattern" "^[\)\]\},.!?:;""']")
    lineSplitPattern = [string](Get-ConfigValue $rulesConfig "text.lineSplitPattern" "(\r\n|\r|\n)")
    idiomaticJoiner = [string](Get-ConfigValue $rulesConfig "translation.fallback.idiomaticJoiner" " ")
    idiomaticPunctuation = [string](Get-ConfigValue $rulesConfig "translation.fallback.idiomaticPunctuation" ".")
    capitalizeIdiomatic = [bool](Get-ConfigValue $rulesConfig "translation.fallback.capitalizeIdiomatic" $true)
    idiomaticSource = [string](Get-ConfigValue $rulesConfig "translation.fallback.idiomaticSource" "resolvedWords")
    idiomaticTemplate = [string](Get-ConfigValue $rulesConfig "translation.fallback.idiomaticTemplate" "")
    literalSource = [string](Get-ConfigValue $rulesConfig "translation.fallback.literalSource" "resolvedGloss")
  }
}

function Get-AnalysisConfig($rulesConfig) {
  $configuredRecoveryOrder = Get-ConfigValue $rulesConfig "analysis.recoveryOrder" @("direct", "normalization", "segmentation")
  $recoveryOrder = if (
    $configuredRecoveryOrder -is [System.Collections.IEnumerable] -and
    $configuredRecoveryOrder -isnot [string] -and
    $configuredRecoveryOrder.Count -eq 1 -and
    $configuredRecoveryOrder[0] -is [System.Collections.IEnumerable] -and
    $configuredRecoveryOrder[0] -isnot [string]
  ) {
    @($configuredRecoveryOrder[0])
  } else {
    @($configuredRecoveryOrder)
  }
  $configuredUnknownPath = Get-ConfigValue $rulesConfig "analysis.unknown.path" @("unknown")
  $unknownPath = if (
    $configuredUnknownPath -is [System.Collections.IEnumerable] -and
    $configuredUnknownPath -isnot [string] -and
    $configuredUnknownPath.Count -eq 1 -and
    $configuredUnknownPath[0] -is [System.Collections.IEnumerable] -and
    $configuredUnknownPath[0] -isnot [string]
  ) {
    @($configuredUnknownPath[0])
  } else {
    @($configuredUnknownPath)
  }

  $defaultStrategyMap = [ordered]@{
    direct = "direct"
    normalization = "normalization"
    segmentation = "segmentation"
  }
  $configuredStrategyMap = Get-ConfigValue $rulesConfig "analysis.strategyMap" ([pscustomobject]@{})
  $strategyMap = [ordered]@{}
  foreach ($key in @($defaultStrategyMap.Keys)) {
    $strategyMap[$key] = $defaultStrategyMap[$key]
  }
  foreach ($property in $configuredStrategyMap.PSObject.Properties) {
    $alias = [string]$property.Name
    $target = [string]$property.Value
    if (-not [string]::IsNullOrWhiteSpace($alias) -and -not [string]::IsNullOrWhiteSpace($target)) {
      $strategyMap[$alias] = $target
    }
  }

  return [ordered]@{
    recoveryOrder = @($recoveryOrder)
    strategyMap = [pscustomobject]$strategyMap
    directLookup = [string](Get-ConfigValue $rulesConfig "analysis.directLookup" "lexicalPriorityFirst")
    normalizationMissingPartPolicy = [string](Get-ConfigValue $rulesConfig "analysis.normalization.missingPartPolicy" "unknown")
    segmentationMissingPartPolicy = [string](Get-ConfigValue $rulesConfig "analysis.segmentation.missingPartPolicy" "unknown")
    synthesisJoiner = [string](Get-ConfigValue $rulesConfig "analysis.synthesis.joiner" " + ")
    normalizationNote = [string](Get-ConfigValue $rulesConfig "analysis.normalization.note" "Recovered through normalization.")
    normalizationStatus = [string](Get-ConfigValue $rulesConfig "analysis.normalization.status" "inferred")
    normalizationRegister = [string](Get-ConfigValue $rulesConfig "analysis.normalization.register" "source")
    unknownFormat = [string](Get-ConfigValue $rulesConfig "analysis.unknown.format" "[{token}]")
    unknownNote = [string](Get-ConfigValue $rulesConfig "analysis.unknown.note" "No direct, normalized, or affixed recovery succeeded.")
    unknownStatus = [string](Get-ConfigValue $rulesConfig "analysis.unknown.status" "unknown")
    unknownRegister = [string](Get-ConfigValue $rulesConfig "analysis.unknown.register" "unknown")
    unknownPath = @($unknownPath)
    headSource = [string](Get-ConfigValue $rulesConfig "analysis.projections.headSource" "headword")
    componentSource = [string](Get-ConfigValue $rulesConfig "analysis.projections.componentSource" "componentsOrHeadword")
    normalizedTokenSource = [string](Get-ConfigValue $rulesConfig "analysis.projections.normalizedTokenSource" "componentsOrHeadword")
    allowLegacyProductiveSuffixFallback = [bool](Get-ConfigValue $rulesConfig "analysis.compat.allowLegacyProductiveSuffixFallback" $true)
  }
}

function Get-CompositionConfig($rulesConfig) {
  $defaultStrategyMap = [ordered]@{
    phrase = "phrase"
    lexical = "lexical"
    contextual = "contextual"
    joined = "joined"
    primary = "primary"
  }
  $configuredStrategyMap = Get-ConfigValue $rulesConfig "composition.strategyMap" ([pscustomobject]@{})
  $strategyMap = [ordered]@{}
  foreach ($key in @($defaultStrategyMap.Keys)) {
    $strategyMap[$key] = $defaultStrategyMap[$key]
  }
  foreach ($property in $configuredStrategyMap.PSObject.Properties) {
    $alias = [string]$property.Name
    $target = [string]$property.Value
    if (-not [string]::IsNullOrWhiteSpace($alias) -and -not [string]::IsNullOrWhiteSpace($target)) {
      $strategyMap[$alias] = $target
    }
  }

  $defaultStrategyDefinitions = [ordered]@{
    phrase = [ordered]@{
      requires = "phrase"
      outputs = [ordered]@{
        primary = "phrase"
        literal = "phrase"
        narrative = "phrase"
        resolved = "phrase"
      }
    }
    lexical = [ordered]@{
      requires = "lexical"
      outputs = [ordered]@{
        primary = "lexical"
        literal = "lexical"
        narrative = "lexical"
        resolved = "lexical"
      }
    }
    contextual = [ordered]@{
      requires = "contextual"
      outputs = [ordered]@{
        primary = "contextual"
        literal = "fallbackLiteral"
        narrative = "fallbackNarrative"
        resolved = "contextual"
      }
    }
    joined = [ordered]@{
      outputs = [ordered]@{
        primary = "fallbackPrimary"
        literal = "fallbackLiteral"
        narrative = "fallbackNarrative"
        resolved = "fallbackJoined"
      }
    }
    primary = [ordered]@{
      outputs = [ordered]@{
        primary = "fallbackPrimary"
        literal = "fallbackLiteral"
        narrative = "fallbackNarrative"
        resolved = "fallbackPrimary"
      }
    }
  }

  $configuredStrategyDefinitions = Get-ConfigValue $rulesConfig "composition.strategies" ([pscustomobject]@{})
  $strategyDefinitions = [ordered]@{}
  foreach ($key in @($defaultStrategyDefinitions.Keys)) {
    $strategyDefinitions[$key] = $defaultStrategyDefinitions[$key]
  }
  foreach ($property in $configuredStrategyDefinitions.PSObject.Properties) {
    $strategyDefinitions[[string]$property.Name] = $property.Value
  }

  return [ordered]@{
    strategyMap = [pscustomobject]$strategyMap
    strategyDefinitions = [pscustomobject]$strategyDefinitions
    directResolutionOrder = @(ConvertTo-ArrayValue (Get-ConfigValue $rulesConfig "composition.resolution.directOrder" @("phrase", "lexical", "primary")))
    normalizedResolutionOrder = @(ConvertTo-ArrayValue (Get-ConfigValue $rulesConfig "composition.resolution.normalizedOrder" @("phrase", "lexical", "contextual", "joined")))
    segmentedResolutionOrder = @(ConvertTo-ArrayValue (Get-ConfigValue $rulesConfig "composition.resolution.segmentedOrder" @("phrase", "lexical", "joined")))
  }
}

function Get-AnalysisProjectionValues($analysis, $sourceName) {
  $resolvedSource = if ([string]::IsNullOrWhiteSpace([string]$sourceName)) { "componentsOrHeadword" } else { [string]$sourceName }

  $convertProjectionValue = {
    param($value)

    if ($null -eq $value) {
      return @()
    }

    if ($value -is [string]) {
      if ([string]::IsNullOrWhiteSpace($value)) {
        return @()
      }

      return @([string]$value)
    }

    if ($value -is [System.Collections.IEnumerable] -and $value -isnot [System.Collections.IDictionary]) {
      $items = @($value | Where-Object { $null -ne $_ -and -not [string]::IsNullOrWhiteSpace([string]$_) })
      return @($items | ForEach-Object { [string]$_ })
    }

    return @([string]$value)
  }

  switch ($resolvedSource) {
    "headword" {
      return @((Normalize-AncientKey $analysis.headword))
    }
    "components" {
      return @($analysis.components)
    }
    "componentsOrHeadword" {
      if ($analysis.components.Count) {
        return @($analysis.components)
      }
      return @((Normalize-AncientKey $analysis.headword))
    }
    "path" {
      return @($analysis.path)
    }
    default {
      $configured = Get-ConfigValue $analysis $resolvedSource $null
      if ($null -ne $configured) {
        return @(& $convertProjectionValue $configured)
      }

      if ($analysis.components.Count) {
        return @($analysis.components)
      }
      return @((Normalize-AncientKey $analysis.headword))
    }
  }
}

function Format-AnalysisToken($template, $token) {
  $resolvedTemplate = if ([string]::IsNullOrWhiteSpace([string]$template)) { "[{token}]" } else { [string]$template }
  return $resolvedTemplate.Replace("{token}", [string]$token)
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
  if ($null -eq $value) {
    return $false
  }

  if ($value -is [string]) {
    return $value -ne $sentinel
  }

  if ($value -is [System.Collections.IEnumerable] -and $value -isnot [System.Collections.IDictionary]) {
    return $true
  }

  return $true
}

function Get-SchemaArray($schema, $path, $fallback) {
  return @(
    ConvertTo-ArrayValue (Get-ConfigValue $schema $path $fallback)
  )
}

function Get-LanguagePackValidation($lexiconPayload, $rulesConfig) {
  $issues = @()
  $schema = Read-LanguagePackSchema
  $fieldMap = Get-LexiconFieldMap $rulesConfig
  $confirmed = Normalize-LexiconEntries $lexiconPayload.confirmed $fieldMap "confirmed"
  $inferred = Normalize-LexiconEntries $lexiconPayload.inferred $fieldMap "inferred"
  $entries = @($confirmed)
  if ($inferred.Count) {
    $entries += @($inferred)
  }
  $language = Get-LanguageMetadata $rulesConfig

  if (-not $confirmed.Count) {
    $issues = Add-ValidationIssue $issues "warning" "The language pack does not yet contain any confirmed lexicon entries."
  }

  $requiredLexiconFields = Get-SchemaArray $schema "lexicon.entry.requiredFields" @("headword", "meanings")
  foreach ($fieldName in $requiredLexiconFields) {
    $mappedPath = [string](Get-ConfigValue $fieldMap $fieldName "")
    if ([string]::IsNullOrWhiteSpace($mappedPath)) {
      $issues = Add-ValidationIssue $issues "error" "lexicon.fieldMap must define a non-empty mapping for '$fieldName'."
    }
  }

  $recommendedLexiconFields = Get-SchemaArray $schema "lexicon.entry.recommendedFields" @(
    "status",
    "register",
    "components",
    "etymology",
    "notes",
    "pronunciation",
    "lexicalized",
    "allowNominalReading",
    "partOfSpeech"
  )
  foreach ($fieldName in $recommendedLexiconFields) {
    $mappedPath = [string](Get-ConfigValue $fieldMap $fieldName "")
    if ([string]::IsNullOrWhiteSpace($mappedPath)) {
      $issues = Add-ValidationIssue $issues "warning" "lexicon.fieldMap should define a mapping for '$fieldName'."
    }
  }

  $seenAncient = @{}
  foreach ($entry in $entries) {
    $ancient = Normalize-AncientKey $entry.ancient
    if (-not $ancient) {
      $issues = Add-ValidationIssue $issues "error" "Each lexicon entry must define a non-empty source headword after field mapping."
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

  $requiredRulePaths = Get-SchemaArray $schema "rules.requiredPaths" @(
    "language.name",
    "english.fillers",
    "normalization",
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

  $recommendedRulePaths = Get-SchemaArray $schema "rules.recommendedPaths" @(
    "language.version",
    "language.description",
    "lexicon.fieldMap",
    "workspace.markdown",
    "english.aliases",
    "morphology.segmenters",
    "morphology.productiveSuffixes",
    "composition.contextualRenderings",
    "translation.englishToAncientOverrides",
    "translation.defaultResolvers",
    "translation.syntaxPatterns",
    "translation.segmentResolvers",
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
  $defaultResolvers = Get-MapFromConfig $rulesConfig "translation.defaultResolvers"
  $segmentResolvers = Get-MapFromConfig $rulesConfig "translation.segmentResolvers"
  $knownResolvers = @{}
  foreach ($key in @($defaultResolvers.Keys)) {
    $knownResolvers[$key] = $defaultResolvers[$key]
  }
  foreach ($key in @($segmentResolvers.Keys)) {
    $knownResolvers[$key] = $segmentResolvers[$key]
  }
  foreach ($pattern in $syntaxPatterns) {
    $template = [string](Get-ConfigValue $pattern "template" "")
    if (-not $template) {
      $issues = Add-ValidationIssue $issues "warning" "Each syntax pattern should define a non-empty template."
    }

    $match = Get-ConfigValue $pattern "match" $null
    if ($null -eq $match) {
      $issues = Add-ValidationIssue $issues "warning" "Each syntax pattern should define a match block."
    }

    foreach ($segmentName in (Get-SyntaxPatternPlaceholderNames $template)) {
      $segment = Get-SyntaxPatternSegmentDefinition $pattern $segmentName
      if ($null -eq $segment) {
        $issues = Add-ValidationIssue $issues "warning" "Syntax pattern template references placeholder '{$segmentName}' without defining a matching segment."
        continue
      }

      $resolverName = [string](Get-ConfigValue $segment "resolver" "")
      if (-not $resolverName) {
        continue
      }

      if (-not $knownResolvers.ContainsKey($resolverName)) {
        $issues = Add-ValidationIssue $issues "warning" "Syntax pattern segment '$segmentName' references unknown resolver '$resolverName'."
      }
    }
  }

  $resolverTypes = Get-SchemaArray $schema "translation.resolverTypes" @("phrase", "head", "branch")
  foreach ($resolverName in @($knownResolvers.Keys)) {
    $resolver = $knownResolvers[$resolverName]
    $resolverType = [string](Get-ConfigValue $resolver "type" "")
    if ($resolverType -and ($resolverTypes -notcontains $resolverType)) {
      $issues = Add-ValidationIssue $issues "warning" "Segment resolver '$resolverName' uses unknown type '$resolverType'."
    }
  }

  $segmenters = ConvertTo-ArrayValue (Get-ConfigValue $rulesConfig "morphology.segmenters" @())
  $segmenterTypes = Get-SchemaArray $schema "morphology.segmenterTypes" @("affix_split")
  foreach ($segmenter in $segmenters) {
    $segmenterType = [string](Get-ConfigValue $segmenter "type" "")
    if ($segmenterType -and ($segmenterTypes -notcontains $segmenterType)) {
      $issues = Add-ValidationIssue $issues "warning" "Morphology segmenter uses unknown type '$segmenterType'."
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

function Tokenize-TranslatorText($contextOrRules, $text) {
  $safeText = if ($null -eq $text) { "" } else { [string]$text }
  $rulesConfig = if ($null -ne $contextOrRules -and $null -ne $contextOrRules.Rules) { $contextOrRules.Rules } else { $contextOrRules }
  $config = Get-TextProcessingConfig $rulesConfig
  $matches = [regex]::Matches($safeText, $config.tokenPattern)
  return @($matches | ForEach-Object { $_.Value })
}

function Join-TranslatorTokens($contextOrRules, $tokens) {
  $result = ""
  $rulesConfig = if ($null -ne $contextOrRules -and $null -ne $contextOrRules.Rules) { $contextOrRules.Rules } else { $contextOrRules }
  $config = Get-TextProcessingConfig $rulesConfig

  foreach ($token in $tokens) {
    if ($token -match "^(?:\r\n|\r|\n|[ \t]+)$") {
      $result += $token
      continue
    }

    if (-not $result.Length) {
      $result = $token
      continue
    }

    if ($result -match $config.noSpaceAfterPattern -or $token -match $config.noSpaceBeforePattern) {
      $result += $token
      continue
    }

    $result += $config.joinSpace
    $result += $token
  }

  return $result
}

function Split-TranslatorLines($contextOrRules, $text) {
  $safeText = if ($null -eq $text) { "" } else { [string]$text }
  $rulesConfig = if ($null -ne $contextOrRules -and $null -ne $contextOrRules.Rules) { $contextOrRules.Rules } else { $contextOrRules }
  $config = Get-TextProcessingConfig $rulesConfig
  $parts = [regex]::Split($safeText, $config.lineSplitPattern)
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

function Get-AnalysisWordSource($analysisState, $sourceName) {
  switch ($sourceName) {
    "primaryWords" { return @($analysisState.primaryWords) }
    "literalWords" { return @($analysisState.literalWords) }
    "narrativeWords" { return @($analysisState.narrativeWords) }
    "resolvedWords" { return @($analysisState.resolvedWords) }
    default { return @($analysisState.resolvedWords) }
  }
}

function Get-FallbackTemplateText($template, $analysisState, $config) {
  $resolvedWords = @(Get-AnalysisWordSource $analysisState "resolvedWords" | Where-Object { $_ })
  $literalWords = @(Get-AnalysisWordSource $analysisState "literalWords" | Where-Object { $_ })
  $narrativeWords = @(Get-AnalysisWordSource $analysisState "narrativeWords" | Where-Object { $_ })
  $primaryWords = @(Get-AnalysisWordSource $analysisState "primaryWords" | Where-Object { $_ })
  $selectedWords = @(Get-AnalysisWordSource $analysisState $config.idiomaticSource | Where-Object { $_ })

  $replacements = [ordered]@{
    "{words}" = (@($selectedWords) -join $config.idiomaticJoiner).Trim()
    "{first}" = $(if ($selectedWords.Count) { [string]$selectedWords[0] } else { "" })
    "{rest}" = $(if ($selectedWords.Count -gt 1) { (@($selectedWords | Select-Object -Skip 1) -join $config.idiomaticJoiner).Trim() } else { "" })
    "{resolvedWords}" = (@($resolvedWords) -join $config.idiomaticJoiner).Trim()
    "{literalWords}" = (@($literalWords) -join $config.idiomaticJoiner).Trim()
    "{narrativeWords}" = (@($narrativeWords) -join $config.idiomaticJoiner).Trim()
    "{primaryWords}" = (@($primaryWords) -join $config.idiomaticJoiner).Trim()
  }

  $output = [string]$template
  foreach ($placeholder in @($replacements.Keys)) {
    $output = $output.Replace($placeholder, [string]$replacements[$placeholder])
  }

  $output = $output -replace "\s+", " "
  $output = $output -replace "\s+([,.;!?])", '$1'
  return $output.Trim()
}

function Build-IdiomaticFallbackText($context, $analysisState) {
  $config = Get-TextProcessingConfig $context.Rules
  $sentence = if (-not [string]::IsNullOrWhiteSpace($config.idiomaticTemplate)) {
    Get-FallbackTemplateText $config.idiomaticTemplate $analysisState $config
  } else {
    $words = @(
      Get-AnalysisWordSource $analysisState $config.idiomaticSource |
      Where-Object { $_ }
    )
    ((@($words) -join $config.idiomaticJoiner).Trim())
  }

  if ($sentence -and $config.idiomaticPunctuation -and $sentence -notmatch "[.!?]$") {
    $sentence += $config.idiomaticPunctuation
  }
  if ($sentence -and $config.capitalizeIdiomatic) {
    $sentence = Capitalize-Text $sentence
  }

  return $sentence
}

function New-TranslationContext($includeInferred) {
  $lexiconPayload = Read-LexiconPayload
  $rulesConfig = Read-RulesConfig
  $language = Get-LanguageMetadata $rulesConfig
  $fieldMap = Get-LexiconFieldMap $rulesConfig
  $validation = Get-LanguagePackValidation $lexiconPayload $rulesConfig
  if (-not $validation.valid) {
    $messages = @($validation.errors | ForEach-Object { $_.message })
    throw ("Invalid language pack: {0}" -f ($messages -join " "))
  }
  $confirmed = Normalize-LexiconEntries $lexiconPayload.confirmed $fieldMap "confirmed"
  $inferred = Normalize-LexiconEntries $lexiconPayload.inferred $fieldMap "inferred"
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
    FieldMap = $fieldMap
      Paths = [ordered]@{
        lexicon = $lexiconPath
        rulesConfig = $rulesConfigPath
        rulesNotes = $rulesPath
        schema = $languagePackSchemaPath
      }
    }
  }

function Write-LexiconPayload($payload) {
  $normalized = [ordered]@{
    confirmed = Get-RawLexiconEntries $payload.confirmed
    inferred = Get-RawLexiconEntries $payload.inferred
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
  return ,$set
}

function Get-StringSetFromConfig($rules, $path) {
  $set = New-Object System.Collections.Generic.HashSet[string] ([System.StringComparer]::OrdinalIgnoreCase)
  foreach ($item in (ConvertTo-ArrayValue (Get-ConfigValue $rules $path @()))) {
    if ($item) {
      $safeItem = if ($null -eq $item) { "" } else { [string]$item }
      [void]$set.Add($safeItem.ToLowerInvariant())
    }
  }
  return ,$set
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

function ConvertTo-StringMap($value, $keyNormalizer = $null) {
  $map = @{}
  if ($null -eq $value) {
    return $map
  }

  if ($value -is [System.Collections.IDictionary]) {
    foreach ($key in @($value.Keys)) {
      $normalizedKey = if ($keyNormalizer) { & $keyNormalizer ([string]$key) } else { [string]$key }
      if ($normalizedKey) {
        $map[$normalizedKey] = [string]$value[$key]
      }
    }

    return $map
  }

  foreach ($property in $value.PSObject.Properties) {
    $normalizedKey = if ($keyNormalizer) { & $keyNormalizer $property.Name } else { [string]$property.Name }
    if ($normalizedKey) {
      $map[$normalizedKey] = [string]$property.Value
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
  $lines = Split-TranslatorLines $context $text
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

    $tokens = Tokenize-TranslatorText $context $line.text
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

    $translated += (Join-TranslatorTokens $context (@($output)))
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

function Get-MorphologySegmenters($context) {
  $configured = ConvertTo-ArrayValue (Get-ConfigValue $context.Rules "morphology.segmenters" @())
  if ($configured.Count) {
    return @($configured)
  }

  $analysisConfig = Get-AnalysisConfig $context.Rules
  if (-not $analysisConfig.allowLegacyProductiveSuffixFallback) {
    return @()
  }

  $legacySuffixes = ConvertTo-ArrayValue (Get-ConfigValue $context.Rules "morphology.productiveSuffixes" @())
  if (-not $legacySuffixes.Count) {
    return @()
  }

  return @(
    [pscustomobject]@{
      type = "affix_split"
      side = "suffix"
      affixes = @($legacySuffixes)
      requireStemInLexicon = $true
      path = "legacy-suffix"
      note = "Recovered by legacy productive suffix fallback."
      status = "segmented"
      register = "source"
    }
  )
}

function Find-MorphologySegmentation($context, $token) {
  foreach ($segmenter in (Get-MorphologySegmenters $context)) {
    $type = [string](Get-ConfigValue $segmenter "type" "")
    if ($type -ne "affix_split") {
      continue
    }

    $side = [string](Get-ConfigValue $segmenter "side" "suffix")
    $affixes = ConvertTo-ArrayValue (Get-ConfigValue $segmenter "affixes" @())
    foreach ($affix in $affixes) {
      $safeAffix = if ($null -eq $affix) { "" } else { [string]$affix }
      if ([string]::IsNullOrWhiteSpace($safeAffix) -or $token -eq $safeAffix) {
        continue
      }

      $parts = $null
      if ($side -eq "prefix") {
        if (-not $token.StartsWith($safeAffix)) {
          continue
        }

        $stem = $token.Substring($safeAffix.Length)
        if (-not $stem) {
          continue
        }

        $parts = @($safeAffix, $stem)
      } else {
        if (-not $token.EndsWith($safeAffix)) {
          continue
        }

        $stem = $token.Substring(0, $token.Length - $safeAffix.Length)
        if (-not $stem) {
          continue
        }

        $parts = @($stem, $safeAffix)
      }

      $normalizedParts = @($parts | ForEach-Object { Normalize-AncientKey $_ })
      $requireStem = [bool](Get-ConfigValue $segmenter "requireStemInLexicon" $true)
      $stemPart = if ($side -eq "prefix") { $normalizedParts[1] } else { $normalizedParts[0] }
      if ($requireStem -and -not (Get-LexiconEntry $context $stemPart)) {
        continue
      }

      return [ordered]@{
        parts = $normalizedParts
        path = [string](Get-ConfigValue $segmenter "path" "segmented")
        note = [string](Get-ConfigValue $segmenter "note" "Recovered through configured morphology segmentation.")
        status = [string](Get-ConfigValue $segmenter "status" "segmented")
        register = [string](Get-ConfigValue $segmenter "register" "source")
      }
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

function Get-GlossSelectionConfig($rulesConfig) {
  return [ordered]@{
    primaryPath = [string](Get-ConfigValue $rulesConfig "translation.glossSelection.primaryPath" "meanings.0")
    literalPath = [string](Get-ConfigValue $rulesConfig "translation.glossSelection.literalPath" "renderings.literal")
    narrativePath = [string](Get-ConfigValue $rulesConfig "translation.glossSelection.narrativePath" "renderings.narrative")
    narrativeNominalPath = [string](Get-ConfigValue $rulesConfig "translation.glossSelection.narrativeNominalPath" "meanings.1")
    fallbackPath = [string](Get-ConfigValue $rulesConfig "translation.glossSelection.fallbackPath" "ancient")
  }
}

function Resolve-GlossPathValue($glossContext, $path, $fallback = "") {
  if ([string]::IsNullOrWhiteSpace([string]$path)) {
    return [string]$fallback
  }

  $value = Get-ConfigValue $glossContext ([string]$path) $null
  if ($null -eq $value) {
    return [string]$fallback
  }

  if ($value -is [System.Collections.IEnumerable] -and $value -isnot [string] -and $value -isnot [System.Collections.IDictionary]) {
    $items = @($value | Where-Object { $null -ne $_ -and -not [string]::IsNullOrWhiteSpace([string]$_) })
    if ($items.Count) {
      return [string]$items[0]
    }
    return [string]$fallback
  }

  $text = [string]$value
  if ([string]::IsNullOrWhiteSpace($text)) {
    return [string]$fallback
  }

  return $text
}

function Get-EntryGloss($context, $entry, $mode = "narrative") {
  $meanings = ConvertTo-ArrayValue $entry.meanings
  $glossConfig = Get-GlossSelectionConfig $context.Rules
  $renderings = [ordered]@{
    narrative = (Get-NarrativeRendering $context $entry.ancient "narrative")
    literal = (Get-NarrativeRendering $context $entry.ancient "literal")
  }
  $glossContext = [ordered]@{
    ancient = [string]$entry.ancient
    meanings = @($meanings)
    allowNominalReading = [bool]$entry.allowNominalReading
    renderings = $renderings
  }

  $primary = Resolve-GlossPathValue $glossContext $glossConfig.primaryPath ([string]$entry.ancient)
  $fallback = Resolve-GlossPathValue $glossContext $glossConfig.fallbackPath $primary

  if ($mode -eq "literal") {
    return Resolve-GlossPathValue $glossContext $glossConfig.literalPath $primary
  }

  if ($mode -eq "narrative") {
    $narrative = Resolve-GlossPathValue $glossContext $glossConfig.narrativePath ""
    if (-not [string]::IsNullOrWhiteSpace($narrative)) {
      return $narrative
    }

    if ($entry.allowNominalReading) {
      $nominal = Resolve-GlossPathValue $glossContext $glossConfig.narrativeNominalPath ""
      if (-not [string]::IsNullOrWhiteSpace($nominal)) {
        return $nominal
      }
    }
  }

  return $(if ($primary) { $primary } else { $fallback })
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

function New-UnknownAnalysis($context, $token) {
  $analysisConfig = Get-AnalysisConfig $context.Rules
  $unknownGloss = Format-AnalysisToken $analysisConfig.unknownFormat $token

  return [ordered]@{
    token = $token
    headword = $token
    meanings = @($unknownGloss)
    primaryGloss = $unknownGloss
    morphemeGloss = $unknownGloss
    literalGloss = $unknownGloss
    narrativeGloss = $unknownGloss
    resolvedGloss = $unknownGloss
    components = @()
    etymology = @()
    notes = @($analysisConfig.unknownNote)
    status = $analysisConfig.unknownStatus
    register = $analysisConfig.unknownRegister
    pronunciation = ""
    lexicalized = $false
    path = @($analysisConfig.unknownPath)
    isUnknown = $true
  }
}

function Resolve-AnalysisFailurePolicy($context, $token, $policy) {
  switch ([string]$policy) {
    "skip" { return $null }
    default { return New-UnknownAnalysis $context $token }
  }
}

function New-DirectAnalysis($context, $token, $normalized, $entry, $lexicalPriority) {
  $compositionConfig = Get-CompositionConfig $context.Rules
  $meanings = ConvertTo-ArrayValue $entry.meanings
  $components = ConvertTo-ArrayValue $entry.components
  $componentPath = if ($components.Count) { $components } else { @($normalized) }
  $primaryGloss = if ($meanings.Count) { $meanings[0] } else { $entry.ancient }
  $literalGloss = Get-EntryGloss $context $entry "literal"
  $narrativeGloss = Get-EntryGloss $context $entry "narrative"
  $resolved = Resolve-CompositionOutput $context $componentPath @($entry) $compositionConfig.directResolutionOrder $primaryGloss $literalGloss $narrativeGloss $primaryGloss

  return [ordered]@{
    token = $token
    headword = $entry.ancient
    meanings = @($meanings)
    primaryGloss = $resolved.primary
    morphemeGloss = if ($entry.lexicalized) { $primaryGloss } else { Build-MorphemeGloss $context $components $primaryGloss }
    literalGloss = $resolved.literal
    narrativeGloss = $resolved.narrative
    resolvedGloss = $resolved.resolved
    components = @($components)
    etymology = ConvertTo-ArrayValue $entry.etymology
    notes = ConvertTo-ArrayValue $entry.notes
    status = if ($entry.status) { $entry.status } else { "confirmed" }
    register = if ($entry.register) { $entry.register } else { "source" }
    pronunciation = if ($entry.pronunciation) { $entry.pronunciation } else { "" }
    lexicalized = [bool]$entry.lexicalized
    path = @(if ($lexicalPriority.Contains($normalized)) { @("direct", "lexical-priority") } else { @("direct") })
    isUnknown = $false
  }
}

function Resolve-DirectAnalysis($context, $token, $normalized) {
  $analysisConfig = Get-AnalysisConfig $context.Rules
  $lexicalPriority = Get-HashSetFromConfig $context.Rules "composition.lexicalPriority"
  $directLookup = [string]$analysisConfig.directLookup
  $entry = $null

  if ($directLookup -eq "simple") {
    $entry = Get-LexiconEntry $context $normalized
  } else {
    $entry = if ($lexicalPriority.Contains($normalized)) { Get-LexiconEntry $context $normalized } else { $null }
    if (-not $entry) {
      $entry = Get-LexiconEntry $context $normalized
    }
  }

  if (-not $entry) {
    return $null
  }

  return New-DirectAnalysis $context $token $normalized $entry $lexicalPriority
}

function Resolve-NormalizedAnalysis($context, $token, $normalized) {
  $analysisConfig = Get-AnalysisConfig $context.Rules
  $compositionConfig = Get-CompositionConfig $context.Rules
  $normalizedParts = Resolve-Normalization $context $normalized
  if (-not $normalizedParts) {
    return $null
  }

  $resolved = @()
  foreach ($part in $normalizedParts) {
    $resolvedEntry = Get-LexiconEntry $context $part
    if (-not $resolvedEntry) {
      return Resolve-AnalysisFailurePolicy $context $token $analysisConfig.normalizationMissingPartPolicy
    }
    $resolved += $resolvedEntry
  }

  $joinedPrimary = ($resolved | ForEach-Object { $_.meanings[0] }) -join $analysisConfig.synthesisJoiner
  $joinedLiteral = ($resolved | ForEach-Object { Get-EntryGloss $context $_ "literal" }) -join $analysisConfig.synthesisJoiner
  $joinedNarrative = ($resolved | ForEach-Object { Get-EntryGloss $context $_ "narrative" }) -join $analysisConfig.synthesisJoiner
  $resolvedOutput = Resolve-CompositionOutput $context $normalizedParts $resolved $compositionConfig.normalizedResolutionOrder $joinedPrimary $joinedLiteral $joinedNarrative $joinedPrimary
  return [ordered]@{
    token = $token
    headword = $token
    meanings = @($resolvedOutput.primary)
    primaryGloss = $resolvedOutput.primary
    morphemeGloss = $joinedPrimary
    literalGloss = $resolvedOutput.literal
    narrativeGloss = $resolvedOutput.narrative
    resolvedGloss = $resolvedOutput.resolved
    components = @($normalizedParts)
    etymology = @()
    notes = @([string]$analysisConfig.normalizationNote)
    status = [string]$analysisConfig.normalizationStatus
    register = [string]$analysisConfig.normalizationRegister
    pronunciation = ""
    lexicalized = $false
    path = @("normalized")
    isUnknown = $false
  }
}

function Resolve-SegmentedAnalysis($context, $token, $normalized) {
  $analysisConfig = Get-AnalysisConfig $context.Rules
  $compositionConfig = Get-CompositionConfig $context.Rules
  $segmentation = Find-MorphologySegmentation $context $normalized
  if (-not $segmentation) {
    return $null
  }

  $segmentationParts = @($segmentation.parts)
  $resolved = @()
  foreach ($part in $segmentationParts) {
    $resolvedEntry = Get-LexiconEntry $context $part
    if (-not $resolvedEntry) {
      return Resolve-AnalysisFailurePolicy $context $token $analysisConfig.segmentationMissingPartPolicy
    }
    $resolved += $resolvedEntry
  }

  $joinedPrimary = ($resolved | ForEach-Object { $_.meanings[0] }) -join $analysisConfig.synthesisJoiner
  $joinedLiteral = ($resolved | ForEach-Object { Get-EntryGloss $context $_ "literal" }) -join $analysisConfig.synthesisJoiner
  $joinedNarrative = ($resolved | ForEach-Object { Get-EntryGloss $context $_ "narrative" }) -join $analysisConfig.synthesisJoiner
  $resolvedOutput = Resolve-CompositionOutput $context $segmentationParts $resolved $compositionConfig.segmentedResolutionOrder $joinedPrimary $joinedLiteral $joinedNarrative $joinedPrimary
  return [ordered]@{
    token = $token
    headword = $token
    meanings = @($resolvedOutput.primary)
    primaryGloss = $resolvedOutput.primary
    morphemeGloss = $joinedPrimary
    literalGloss = $resolvedOutput.literal
    narrativeGloss = $resolvedOutput.narrative
    resolvedGloss = $resolvedOutput.resolved
    components = @($segmentationParts)
    etymology = @()
    notes = @([string]$segmentation.note)
    status = [string]$segmentation.status
    register = [string]$segmentation.register
    pronunciation = ""
    lexicalized = $false
    path = @([string]$segmentation.path)
    isUnknown = $false
  }
}

function Resolve-CompositionOutput($context, $parts, $resolvedEntries, $strategies, $fallbackPrimary, $fallbackLiteral, $fallbackNarrative, $fallbackJoined) {
  $compositionConfig = Get-CompositionConfig $context.Rules
  $strategyMap = ConvertTo-StringMap $compositionConfig.strategyMap
  $strategyDefinitions = Get-MapFromConfig $compositionConfig "strategyDefinitions"
  $phrase = Get-PhraseRendering $context $parts
  $lexical = Get-LexicalCollapse $context $parts
  $contextual = Get-ContextualRendering $context $parts
  $availableValues = [ordered]@{
    phrase = $phrase
    lexical = $lexical
    contextual = $contextual
    fallbackPrimary = $fallbackPrimary
    fallbackLiteral = $fallbackLiteral
    fallbackNarrative = $fallbackNarrative
    fallbackJoined = $fallbackJoined
  }

  foreach ($strategy in @($strategies)) {
    $strategyName = [string]$strategy
    $resolvedStrategy = if ($strategyMap.ContainsKey($strategyName)) { [string]$strategyMap[$strategyName] } else { $strategyName }
    if (-not $strategyDefinitions.ContainsKey($resolvedStrategy)) {
      continue
    }

    $definition = $strategyDefinitions[$resolvedStrategy]
    $requiredSource = [string](Get-ConfigValue $definition "requires" "")
    if ($requiredSource) {
      $requiredValue = [string](Get-ConfigValue $availableValues $requiredSource "")
      if ([string]::IsNullOrWhiteSpace($requiredValue)) {
        continue
      }
    }

    $outputs = Get-ConfigValue $definition "outputs" $null
    if ($null -eq $outputs) {
      switch ($resolvedStrategy) {
        "joined" {
          return [ordered]@{
            primary = $fallbackPrimary
            literal = $fallbackLiteral
            narrative = $fallbackNarrative
            resolved = $fallbackJoined
          }
        }
        "primary" {
          return [ordered]@{
            primary = $fallbackPrimary
            literal = $fallbackLiteral
            narrative = $fallbackNarrative
            resolved = $fallbackPrimary
          }
        }
      }
      continue
    }

    $resolvedOutput = [ordered]@{}
    foreach ($field in @("primary", "literal", "narrative", "resolved")) {
      $sourceName = [string](Get-ConfigValue $outputs $field "")
      $sourceValue = if ($sourceName) { [string](Get-ConfigValue $availableValues $sourceName "") } else { "" }
      $resolvedOutput[$field] = $sourceValue
    }

    if (
      -not [string]::IsNullOrWhiteSpace([string]$resolvedOutput.primary) -or
      -not [string]::IsNullOrWhiteSpace([string]$resolvedOutput.literal) -or
      -not [string]::IsNullOrWhiteSpace([string]$resolvedOutput.narrative) -or
      -not [string]::IsNullOrWhiteSpace([string]$resolvedOutput.resolved)
    ) {
      return $resolvedOutput
    }
  }

  return [ordered]@{
    primary = $fallbackPrimary
    literal = $fallbackLiteral
    narrative = $fallbackNarrative
    resolved = $fallbackJoined
  }
}

function Analyze-AncientTokenApi($context, $token) {
  $normalized = Normalize-AncientKey $token
  $analysisConfig = Get-AnalysisConfig $context.Rules
  $strategyMap = ConvertTo-StringMap $analysisConfig.strategyMap

  foreach ($strategy in @($analysisConfig.recoveryOrder)) {
    $strategyName = [string]$strategy
    $resolvedStrategy = if ($strategyMap.ContainsKey($strategyName)) { [string]$strategyMap[$strategyName] } else { $strategyName }
    $analysis = switch ($resolvedStrategy) {
      "direct" { Resolve-DirectAnalysis $context $token $normalized }
      "normalization" { Resolve-NormalizedAnalysis $context $token $normalized }
      "segmentation" { Resolve-SegmentedAnalysis $context $token $normalized }
      default { $null }
    }

    if ($null -ne $analysis) {
      return $analysis
    }
  }

  return New-UnknownAnalysis $context $token
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

function Get-SegmentResolverDefinitions($context) {
  $resolverMap = @{}
  $defaultConfigured = Get-ConfigValue $context.Rules "translation.defaultResolvers" ([pscustomobject]@{})
  foreach ($property in $defaultConfigured.PSObject.Properties) {
    $resolverMap[$property.Name] = $property.Value
  }

  $configured = Get-ConfigValue $context.Rules "translation.segmentResolvers" ([pscustomobject]@{})
  foreach ($property in $configured.PSObject.Properties) {
    $resolverMap[$property.Name] = $property.Value
  }

  if (-not $resolverMap.ContainsKey("verb")) {
    $resolverMap["verb"] = [pscustomobject]@{
      type = "head"
      source = "heads"
      selection = "index"
      defaultIndex = 0
      glossMode = "narrative"
    }
  }

  if (-not $resolverMap.ContainsKey("raw")) {
    $resolverMap["raw"] = [pscustomobject]@{
      type = "phrase"
      source = "resolvedWords"
      selection = "range"
      defaultStart = 0
    }
  }

  return $resolverMap
}

function Get-ResolverByName($context, $resolverName) {
  $definitions = Get-SegmentResolverDefinitions $context
  if ($definitions.ContainsKey($resolverName)) {
    return $definitions[$resolverName]
  }

  return $null
}

function Normalize-RenderLookupKey($value) {
  return (Normalize-EnglishKey $value)
}

function Get-RenderSequenceTokens($analysisState, $sourceName, $start = 0, $index = -1) {
  $tokens = switch ($sourceName) {
    "heads" { @($analysisState.heads) }
    "components" { @($analysisState.components) }
    "resolvedWords" { @($analysisState.resolvedWords) }
    default { @($analysisState.resolvedWords) }
  }

  if ($tokens.Count -eq 1 -and $tokens[0] -is [System.Collections.IEnumerable] -and $tokens[0] -isnot [string]) {
    $tokens = @($tokens[0])
  }

  if ($index -ge 0) {
    if ($index -lt $tokens.Count) {
      return ,@($tokens[$index])
    }

    return ,@()
  }

  if ($start -gt 0) {
    return ,@($tokens | Select-Object -Skip $start)
  }

  return ,@($tokens)
}

function Get-RenderTextTokens($analysisState, $sourceName, $start = 0, $index = -1) {
  $tokens = switch ($sourceName) {
    "heads" { @($analysisState.heads) }
    "literalWords" { @($analysisState.literalWords) }
    "narrativeWords" { @($analysisState.narrativeWords) }
    "primaryWords" { @($analysisState.primaryWords) }
    default { @($analysisState.resolvedWords) }
  }

  if ($tokens.Count -eq 1 -and $tokens[0] -is [System.Collections.IEnumerable] -and $tokens[0] -isnot [string]) {
    $tokens = @($tokens[0])
  }

  if ($index -ge 0) {
    if ($index -lt $tokens.Count) {
      return ,@($tokens[$index])
    }

    return ,@()
  }

  if ($start -gt 0) {
    return ,@($tokens | Select-Object -Skip $start)
  }

  return ,@($tokens)
}

function Resolve-RendererPhrase($analysisState, $renderer, $selectedTokens, $sequenceTokens) {
  $parts = @($selectedTokens | Where-Object { -not [string]::IsNullOrWhiteSpace([string]$_) })
  if (-not $parts.Count) {
    return ""
  }

  foreach ($override in (ConvertTo-ArrayValue (Get-ConfigValue $renderer "sequenceOverrides" @()))) {
    $includes = @((ConvertTo-ArrayValue (Get-ConfigValue $override "includes" @())) | ForEach-Object { Normalize-AncientKey $_ })
    if ($includes.Count -and ($includes | Where-Object { $sequenceTokens -contains $_ }).Count -eq $includes.Count) {
      return [string](Get-ConfigValue $override "output" "")
    }
  }

  $joined = (@($parts) -join [string](Get-ConfigValue $renderer "joiner" " ")).Trim()
  if (-not $joined) {
    return ""
  }

  $lookupKey = Normalize-RenderLookupKey $joined
  $exactMap = ConvertTo-StringMap (Get-ConfigValue $renderer "exactMap" ([pscustomobject]@{})) ${function:Normalize-RenderLookupKey}
  if ($exactMap.ContainsKey($lookupKey)) {
    return $exactMap[$lookupKey]
  }

  $articleMap = ConvertTo-StringMap (Get-ConfigValue $renderer "articleMap" ([pscustomobject]@{})) ${function:Normalize-RenderLookupKey}
  if ($articleMap.ContainsKey($lookupKey)) {
    $prefix = [string](Get-ConfigValue $renderer "articlePrefix" " ")
    return "$($articleMap[$lookupKey])$prefix$joined"
  }

  return $joined
}

function Resolve-SegmentWithRenderer($context, $analysisState, $renderer, $segment) {
  if ($null -eq $renderer) {
    return ""
  }

  $rendererType = [string](Get-ConfigValue $renderer "type" "phrase")
  $selection = [string](Get-ConfigValue $renderer "selection" "range")
  $index = [int](Get-ConfigValue $segment "index" (Get-ConfigValue $renderer "defaultIndex" -1))
  $start = [int](Get-ConfigValue $segment "start" (Get-ConfigValue $renderer "defaultStart" 0))
  $resolverSource = [string](Get-ConfigValue $renderer "source" "resolvedWords")

  if ($rendererType -eq "branch") {
    $parts = Get-RenderTextTokens $analysisState $resolverSource $start $index
    $threshold = [int](Get-ConfigValue $renderer "threshold" 1)
    $targetName = if ($parts.Count -le $threshold) {
      [string](Get-ConfigValue $renderer "whenAtMost" "")
    } else {
      [string](Get-ConfigValue $renderer "otherwise" "")
    }

    return Resolve-SegmentWithRenderer $context $analysisState (Get-ResolverByName $context $targetName) $segment
  }

  if ($rendererType -eq "head") {
    $headTokens = Get-RenderTextTokens $analysisState "heads" $start $index
    if (-not $headTokens.Count) {
      return ""
    }

    $glossMode = [string](Get-ConfigValue $renderer "glossMode" "narrative")
    if ($glossMode -eq "raw") {
      return [string]$headTokens[0]
    }

    $rendered = [string](Get-NarrativeRendering $context $headTokens[0] $glossMode)
    if ($rendered) {
      return $rendered
    }

    $fallbackText = Get-RenderTextTokens $analysisState "$glossMode`Words" $start $index
    if ($fallbackText.Count) {
      return [string]$fallbackText[0]
    }

    return [string]$headTokens[0]
  }

  $textTokens = if ($selection -eq "index") {
    Get-RenderTextTokens $analysisState $resolverSource 0 $index
  } else {
    Get-RenderTextTokens $analysisState $resolverSource $start -1
  }

  $sequenceSource = [string](Get-ConfigValue $renderer "sequenceMatchSource" $resolverSource)
  $sequenceTokens = if ($selection -eq "index") {
    Get-RenderSequenceTokens $analysisState $sequenceSource 0 $index
  } else {
    Get-RenderSequenceTokens $analysisState $sequenceSource $start -1
  }

  return Resolve-RendererPhrase $analysisState $renderer $textTokens $sequenceTokens
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
  $literalSource = [string](Get-ConfigValue $context.Rules "translation.fallback.literalSource" "resolvedGloss")
  $words = @($analyses | ForEach-Object {
    $primaryGloss = [string](Get-ConfigValue $_ "primaryGloss" "")
    $literalGloss = [string](Get-ConfigValue $_ "literalGloss" "")
    $narrativeGloss = [string](Get-ConfigValue $_ "narrativeGloss" "")
    $resolvedGloss = [string](Get-ConfigValue $_ "resolvedGloss" "")
    $word = switch ($literalSource) {
      "primaryGloss" { $primaryGloss }
      "literalGloss" { if ($literalGloss) { $literalGloss } else { $primaryGloss } }
      "narrativeGloss" { if ($narrativeGloss) { $narrativeGloss } else { $primaryGloss } }
      "resolvedGloss" {
        if ($resolvedGloss) { $resolvedGloss }
        elseif ($literalGloss) { $literalGloss }
        else { $primaryGloss }
      }
      default {
        if ($resolvedGloss) { $resolvedGloss }
        elseif ($literalGloss) { $literalGloss }
        else { $primaryGloss }
      }
    }
    $word
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

function Resolve-SyntaxPatternSegment($context, $analysisState, $segment) {
  if ($null -eq $segment) {
    return ""
  }

  $explicitValue = Get-ConfigValue $segment "value" $null
  if ($explicitValue) {
    return [string]$explicitValue
  }

  $resolverName = [string](Get-ConfigValue $segment "resolver" "")
  if (-not $resolverName) {
    $legacyMode = [string](Get-ConfigValue $segment "mode" "raw")
    $resolverName = if ($legacyMode) { $legacyMode } else { "raw" }
  }

  $renderer = Get-ResolverByName $context $resolverName
  $text = Resolve-SegmentWithRenderer $context $analysisState $renderer $segment

  if ([string]::IsNullOrWhiteSpace($text)) {
    return ""
  }

  $prefix = [string](Get-ConfigValue $segment "prefix" "")
  $suffix = [string](Get-ConfigValue $segment "suffix" "")
  return "$prefix$text$suffix"
}

function Get-SyntaxPatternPlaceholderNames($template) {
  $text = if ($null -eq $template) { "" } else { [string]$template }
  if ([string]::IsNullOrWhiteSpace($text)) {
    return @()
  }

  $names = New-Object System.Collections.Generic.List[string]
  foreach ($match in [regex]::Matches($text, "\{([A-Za-z][A-Za-z0-9]*)\}")) {
    $name = [string]$match.Groups[1].Value
    if ($name -and -not $names.Contains($name)) {
      $names.Add($name)
    }
  }

  return @($names)
}

function Get-SyntaxPatternSegmentDefinition($pattern, $segmentName) {
  if ($null -eq $pattern -or [string]::IsNullOrWhiteSpace([string]$segmentName)) {
    return $null
  }

  $direct = Get-ConfigValue $pattern $segmentName $null
  if ($null -ne $direct) {
    return $direct
  }

  return Get-ConfigValue $pattern "segments.$segmentName" $null
}

function Invoke-SyntaxPattern($context, $analysisState) {
  foreach ($pattern in (ConvertTo-ArrayValue (Get-ConfigValue $context.Rules "translation.syntaxPatterns" @()))) {
    if (-not (Test-SyntaxPattern $pattern $analysisState.heads $analysisState.components)) {
      continue
    }

    $template = [string](Get-ConfigValue $pattern "template" "")
    if (-not $template) {
      continue
    }

    foreach ($segmentName in (Get-SyntaxPatternPlaceholderNames $template)) {
      $defaultSegment = if ($segmentName -eq "verb") { [pscustomobject]@{ resolver = "verb"; index = 0 } } else { $null }
      $segment = Get-SyntaxPatternSegmentDefinition $pattern $segmentName
      if ($null -eq $segment) {
        $segment = $defaultSegment
      }

      $replacement = Resolve-SyntaxPatternSegment $context $analysisState $segment
      $placeholder = "{" + [string]$segmentName + "}"
      $template = $template.Replace($placeholder, [string]$replacement)
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
  $analysisConfig = Get-AnalysisConfig $context.Rules
  $tokens = Tokenize-TranslatorText $context $lineText
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
    $normalizedParts = @(Get-AnalysisProjectionValues $analysis $analysisConfig.normalizedTokenSource)
    $normalizedTokens += ,$normalizedParts
  }

  $components = @($wordAnalyses | ForEach-Object {
    @(Get-AnalysisProjectionValues $_ $analysisConfig.componentSource)
  })
  $heads = @($wordAnalyses | ForEach-Object {
    $values = @(Get-AnalysisProjectionValues $_ $analysisConfig.headSource)
    if ($values.Count) { $values[0] }
  })
  $primaryWords = @($wordAnalyses | ForEach-Object { $_.primaryGloss })
  $literalWords = @($wordAnalyses | ForEach-Object {
    if ($_.literalGloss) { $_.literalGloss } else { $_.primaryGloss }
  })
  $narrativeWords = @($wordAnalyses | ForEach-Object {
    if ($_.narrativeGloss) { $_.narrativeGloss } else { $_.primaryGloss }
  })
  $resolvedWords = @($wordAnalyses | ForEach-Object {
    if ($_.resolvedGloss) {
      $_.resolvedGloss
    } elseif ($_.literalGloss) {
      $_.literalGloss
    } else {
      $_.primaryGloss
    }
  })
  $analysisState = [ordered]@{
    resolvedWords = @($resolvedWords)
    primaryWords = @($primaryWords)
    literalWords = @($literalWords)
    narrativeWords = @($narrativeWords)
    heads = @($heads)
    components = @($components)
  }
  $literal = if ($components.Count) { Build-LiteralLineApi $context $wordAnalyses } else { "" }
  $idiomatic = Get-NarrativeOverride $context $lineText $heads $components
  if (-not $idiomatic) {
    $idiomatic = Invoke-SyntaxPattern $context $analysisState
  }
  if (-not $idiomatic) {
    $idiomatic = Build-IdiomaticFallbackText $context $analysisState
  }

  return [ordered]@{
    text = $lineText
    tokens = $wordAnalyses
    normalizedTokens = $normalizedTokens
    morphemeGloss = Join-TranslatorTokens $context $glossTokens
    literal = $literal
    idiomatic = $idiomatic
  }
}

function Analyze-AncientTextApi($context, $text) {
  $lines = Split-TranslatorLines $context $text
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
  $activeDescriptor = Get-ActiveLanguagePackDescriptor
  try {
    $lexiconPayload = Read-LexiconPayload
    $rulesConfig = Read-RulesConfig
    $language = Get-LanguageMetadata $rulesConfig
    $validation = Get-LanguagePackValidation $lexiconPayload $rulesConfig

    return [ordered]@{
      packId = $activeDescriptor.id
      language = $language
      validation = $validation
      activePaths = [ordered]@{
        lexicon = $lexiconPath
        rulesConfig = $rulesConfigPath
        rulesNotes = $rulesPath
        schema = $languagePackSchemaPath
      }
    }
  } catch {
    return [ordered]@{
      packId = $activeDescriptor.id
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
        schema = $languagePackSchemaPath
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
  $fieldMap = Get-LexiconFieldMap $rulesConfig
  $entries = @(
    Normalize-LexiconEntries $lexiconPayload.confirmed $fieldMap "confirmed"
  )
  if ($includeInferred) {
    $entries += @(Normalize-LexiconEntries $lexiconPayload.inferred $fieldMap "inferred")
  }

  $rulesMarkdown = if (Test-Path -LiteralPath $rulesPath -PathType Leaf) {
    Get-Content -LiteralPath $rulesPath -Raw -Encoding UTF8
  } else {
    ""
  }

  $markdown = Build-LexiconMarkdownServer $entries $rulesMarkdown $includeInferred $language
  Write-Response $context 200 $markdown "text/markdown; charset=utf-8"
}

function Get-LanguagePackSchemaReport() {
  $schema = Read-LanguagePackSchema
  return [ordered]@{
    schema = $schema
    path = $languagePackSchemaPath
  }
}

function Handle-LanguagePackSelectionRequest($context) {
  $body = Read-RequestBody $context.Request
  $request = if ([string]::IsNullOrWhiteSpace($body)) { [pscustomobject]@{} } else { $body | ConvertFrom-Json }
  $packId = [string](Get-ConfigValue $request "packId" "")
  if ([string]::IsNullOrWhiteSpace($packId)) {
    Write-Response $context 400 "Missing packId."
    return
  }

  $status = Set-ActiveLanguagePackById $packId
  Write-JsonResponse $context 200 $status
}

function Handle-LanguagePackCreateRequest($context) {
  $body = Read-RequestBody $context.Request
  $request = if ([string]::IsNullOrWhiteSpace($body)) { [pscustomobject]@{} } else { $body | ConvertFrom-Json }
  $status = New-LanguagePackScaffold $request
  Write-JsonResponse $context 201 $status
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
      packId = $packStatus.packId
      language = $packStatus.language
      activePaths = $packStatus.activePaths
      validation = $packStatus.validation
      translationApi = [bool]$packStatus.validation.valid
      lexiconApi = $true
      rulesConfigApi = $true
      rulesNotesApi = $true
      markdownExportApi = $true
      languagePackSchemaApi = $true
    })
    return $true
  }

  if ($path -eq "/api/language-pack") {
    if ($context.Request.HttpMethod -eq "GET") {
      Write-JsonResponse $context 200 (Get-LanguagePackStatus)
      return $true
    }

    if ($context.Request.HttpMethod -eq "POST") {
      Handle-LanguagePackSelectionRequest $context
      return $true
    }

    Write-Response $context 405 "Method Not Allowed"
    return $true
  }

  if ($path -eq "/api/language-packs") {
    if ($context.Request.HttpMethod -eq "GET") {
      Write-JsonResponse $context 200 (Get-LanguagePackRegistryReport)
      return $true
    }

    if ($context.Request.HttpMethod -eq "POST") {
      Handle-LanguagePackCreateRequest $context
      return $true
    }

    Write-Response $context 405 "Method Not Allowed"
    return $true
  }

  if ($path -eq "/api/language-pack-schema") {
    if ($context.Request.HttpMethod -eq "GET") {
      Write-JsonResponse $context 200 (Get-LanguagePackSchemaReport)
      return $true
    }

    if ($context.Request.HttpMethod -eq "PUT") {
      $body = Read-RequestBody $context.Request
      $schema = Write-JsonDocument $languagePackSchemaPath $body
      Write-JsonResponse $context 200 ([ordered]@{
        schema = $schema
        path = $languagePackSchemaPath
      })
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
      Write-JsonResponse $context 200 (Get-RulesConfigReport)
      return $true
    }

    if ($context.Request.HttpMethod -eq "PUT") {
      $body = Read-RequestBody $context.Request
      $config = Write-JsonDocument $rulesConfigPath $body
      Write-JsonResponse $context 200 ([ordered]@{
        config = $config
        path = $rulesConfigPath
      })
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

Initialize-LanguagePackRegistry

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
      $trace = $_.ScriptStackTrace
      if (-not [string]::IsNullOrWhiteSpace($trace)) {
        $message = "$message`n$trace"
      }
      Write-Response $context 500 "Internal Server Error: $message"
    }
  }
} finally {
  $listener.Stop()
  $listener.Close()
}




