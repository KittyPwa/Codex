// Lexicon and rules editor workflows.

function setLexiconEditorStatus(message, isError = false) {
  void message;
  void isError;
}

function cloneJsonDocument(value) {
  return JSON.parse(JSON.stringify(value ?? {}));
}

function parseLineList(value) {
  return String(value ?? "")
    .split(/\r?\n/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function stringifyLineList(values) {
  return Array.isArray(values) ? values.join("\n") : "";
}

function parseKeyValueLines(value) {
  const result = {};
  for (const line of parseLineList(value)) {
    const separatorIndex = line.indexOf("=");
    if (separatorIndex === -1) {
      continue;
    }

    const key = line.slice(0, separatorIndex).trim();
    const mappedValue = line.slice(separatorIndex + 1).trim();
    if (key && mappedValue) {
      result[key] = mappedValue;
    }
  }

  return result;
}

function stringifyKeyValueLines(map) {
  return Object.entries(map ?? {})
    .map(([key, value]) => `${key} = ${value}`)
    .join("\n");
}

function escapeHtmlText(text) {
  return String(text ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function renderTokenPatternPreview() {
  if (!rulesConfigTokenPatternInput || !rulesConfigTokenPreview || !rulesConfigTokenPreviewStatus || !rulesConfigTokenMatchList) {
    return;
  }

  const pattern = rulesConfigTokenPatternInput.value.trim();
  const sampleText = rulesConfigTokenSampleInput?.value ?? "";

  if (!pattern) {
    rulesConfigTokenPreviewStatus.textContent = "Waiting for a token pattern.";
    rulesConfigTokenPreview.innerHTML = escapeHtmlText(sampleText || "Matches will appear here.");
    rulesConfigTokenMatchList.innerHTML = `<span class="token-match-chip token-match-chip-empty">No matches yet.</span>`;
    return;
  }

  try {
    const regex = new RegExp(pattern, "g");
    const matches = [];
    let match;
    while ((match = regex.exec(sampleText)) !== null) {
      const text = match[0];
      if (!text.length) {
        regex.lastIndex += 1;
        continue;
      }

      matches.push({
        start: match.index,
        end: match.index + text.length,
        text
      });
    }

    if (!matches.length) {
      rulesConfigTokenPreviewStatus.textContent = "Valid regex, but it does not match the current sample text.";
      rulesConfigTokenPreview.innerHTML = escapeHtmlText(sampleText || "Matches will appear here.");
      rulesConfigTokenMatchList.innerHTML = `<span class="token-match-chip token-match-chip-empty">No matches found in the sample text.</span>`;
      return;
    }

    let cursor = 0;
    const parts = [];
    for (const tokenMatch of matches) {
      if (tokenMatch.start > cursor) {
        parts.push(`<span>${escapeHtmlText(sampleText.slice(cursor, tokenMatch.start))}</span>`);
      }

      parts.push(`<mark class="token-match">${escapeHtmlText(tokenMatch.text)}</mark>`);
      cursor = tokenMatch.end;
    }

    if (cursor < sampleText.length) {
      parts.push(`<span>${escapeHtmlText(sampleText.slice(cursor))}</span>`);
    }

    rulesConfigTokenPreviewStatus.textContent = `Valid regex. ${matches.length} match${matches.length === 1 ? "" : "es"} highlighted below.`;
    rulesConfigTokenPreview.innerHTML = parts.join("");
    rulesConfigTokenMatchList.innerHTML = matches
      .map((tokenMatch, index) => `<span class="token-match-chip"><strong>${index + 1}.</strong> ${escapeHtmlText(tokenMatch.text)}</span>`)
      .join("");
  } catch (error) {
    rulesConfigTokenPreviewStatus.textContent = error.message || "Invalid regex.";
    rulesConfigTokenPreview.innerHTML = `<span class="token-preview-error">${escapeHtmlText(sampleText || "Matches will appear here.")}</span>`;
    rulesConfigTokenMatchList.innerHTML = `<span class="token-match-chip token-match-chip-empty">Regex error: preview unavailable.</span>`;
  }
}

function setTokenPatternSample(value) {
  if (!rulesConfigTokenSampleInput) {
    return;
  }

  rulesConfigTokenSampleInput.value = value;
  renderTokenPatternPreview();
}

function loadSavedTokenPatternSample() {
  const saved = readPersistedTokenizerSample();
  if (saved === null) {
    if (rulesConfigEditorStatus) {
      rulesConfigEditorStatus.textContent = `No saved custom tokenizer sample for ${getActiveLanguageName()}.`;
    }
    return;
  }

  setTokenPatternSample(saved);
  if (rulesConfigEditorStatus) {
    rulesConfigEditorStatus.textContent = `Loaded saved custom tokenizer sample for ${getActiveLanguageName()}.`;
  }
}

function saveCurrentTokenPatternSample() {
  if (!rulesConfigTokenSampleInput) {
    return;
  }

  persistTokenizerSample(rulesConfigTokenSampleInput.value);
  if (rulesConfigEditorStatus) {
    rulesConfigEditorStatus.textContent = `Saved custom tokenizer sample for ${getActiveLanguageName()}.`;
  }
}

function createBuilderTextRow(value = "", placeholder = "") {
  const row = document.createElement("div");
  row.className = "builder-row";

  const input = document.createElement("input");
  input.type = "text";
  input.className = "control-input builder-input";
  input.placeholder = placeholder;
  input.value = value;

  const removeButton = document.createElement("button");
  removeButton.type = "button";
  removeButton.className = "ghost-button compact-button builder-remove";
  removeButton.textContent = "Remove";
  removeButton.addEventListener("click", () => {
    row.remove();
  });

  row.append(input, removeButton);
  return row;
}

function createBuilderAliasRow(key = "", value = "") {
  const row = document.createElement("div");
  row.className = "builder-row builder-row-alias";

  const keyInput = document.createElement("input");
  keyInput.type = "text";
  keyInput.className = "control-input builder-input builder-key-input";
  keyInput.placeholder = "english word";
  keyInput.value = key;

  const arrow = document.createElement("span");
  arrow.className = "builder-arrow";
  arrow.textContent = "->";

  const valueInput = document.createElement("input");
  valueInput.type = "text";
  valueInput.className = "control-input builder-input builder-value-input";
  valueInput.placeholder = "source form";
  valueInput.value = value;

  const removeButton = document.createElement("button");
  removeButton.type = "button";
  removeButton.className = "ghost-button compact-button builder-remove";
  removeButton.textContent = "Remove";
  removeButton.addEventListener("click", () => {
    row.remove();
  });

  row.append(keyInput, arrow, valueInput, removeButton);
  return row;
}

function renderSimpleListBuilder(container, values, placeholder = "") {
  if (!container) {
    return;
  }

  container.innerHTML = "";
  const list = Array.isArray(values) && values.length ? values : [""];
  for (const value of list) {
    container.append(createBuilderTextRow(value, placeholder));
  }
}

function renderAliasBuilder(container, map) {
  if (!container) {
    return;
  }

  container.innerHTML = "";
  const entries = Object.entries(map ?? {});
  if (!entries.length) {
    container.append(createBuilderAliasRow("", ""));
    return;
  }

  for (const [key, value] of entries) {
    container.append(createBuilderAliasRow(key, value));
  }
}

function readSimpleListBuilder(container) {
  if (!container) {
    return [];
  }

  return Array.from(container.querySelectorAll(".builder-input"))
    .map((input) => input.value.trim())
    .filter(Boolean);
}

function readAliasBuilder(container) {
  if (!container) {
    return {};
  }

  const result = {};
  for (const row of container.querySelectorAll(".builder-row-alias")) {
    const key = row.querySelector(".builder-key-input")?.value.trim();
    const value = row.querySelector(".builder-value-input")?.value.trim();
    if (key && value) {
      result[key] = value;
    }
  }

  return result;
}

function syncRulesConfigGuidedFields() {
  const config = rulesConfigDocument ?? {};
  if (rulesConfigLanguageNameInput) {
    rulesConfigLanguageNameInput.value = config.language?.name ?? "";
  }
  if (rulesConfigLanguageVersionInput) {
    rulesConfigLanguageVersionInput.value = config.language?.version ?? "";
  }
  if (rulesConfigLanguageDescriptionInput) {
    rulesConfigLanguageDescriptionInput.value = config.language?.description ?? "";
  }
  renderSimpleListBuilder(rulesConfigEnglishFillersBuilder, config.english?.fillers, "the");
  renderAliasBuilder(rulesConfigEnglishAliasesBuilder, config.english?.aliases);
  if (rulesConfigTokenPatternInput) {
    rulesConfigTokenPatternInput.value = config.text?.tokenPattern ?? "";
  }
  const savedTokenizerSample = readPersistedTokenizerSample();
  if (rulesConfigTokenSampleInput && savedTokenizerSample !== null) {
    rulesConfigTokenSampleInput.value = savedTokenizerSample;
  }
  renderTokenPatternPreview();
  if (rulesConfigFallbackTemplateInput) {
    rulesConfigFallbackTemplateInput.value = config.translation?.fallback?.idiomaticTemplate ?? "";
  }
  if (rulesConfigFieldHeadwordInput) {
    rulesConfigFieldHeadwordInput.value = config.lexicon?.fieldMap?.headword ?? "";
  }
  if (rulesConfigFieldMeaningsInput) {
    rulesConfigFieldMeaningsInput.value = config.lexicon?.fieldMap?.meanings ?? "";
  }
  if (rulesConfigGlossPrimaryInput) {
    rulesConfigGlossPrimaryInput.value = config.translation?.glossSelection?.primaryPath ?? "";
  }
}

function applyRulesConfigGuidedFields() {
  const nextConfig = cloneJsonDocument(rulesConfigDocument);

  nextConfig.language = nextConfig.language ?? {};
  nextConfig.english = nextConfig.english ?? {};
  nextConfig.text = nextConfig.text ?? {};
  nextConfig.translation = nextConfig.translation ?? {};
  nextConfig.translation.fallback = nextConfig.translation.fallback ?? {};
  nextConfig.translation.glossSelection = nextConfig.translation.glossSelection ?? {};
  nextConfig.lexicon = nextConfig.lexicon ?? {};
  nextConfig.lexicon.fieldMap = nextConfig.lexicon.fieldMap ?? {};

  nextConfig.language.name = rulesConfigLanguageNameInput?.value.trim() ?? "";
  nextConfig.language.version = rulesConfigLanguageVersionInput?.value.trim() ?? "";
  nextConfig.language.description = rulesConfigLanguageDescriptionInput?.value.trim() ?? "";
  nextConfig.english.fillers = readSimpleListBuilder(rulesConfigEnglishFillersBuilder);
  nextConfig.english.aliases = readAliasBuilder(rulesConfigEnglishAliasesBuilder);
  nextConfig.text.tokenPattern = rulesConfigTokenPatternInput?.value.trim() ?? "";
  nextConfig.translation.fallback.idiomaticTemplate = rulesConfigFallbackTemplateInput?.value.trim() ?? "";
  nextConfig.lexicon.fieldMap.headword = rulesConfigFieldHeadwordInput?.value.trim() ?? "";
  nextConfig.lexicon.fieldMap.meanings = rulesConfigFieldMeaningsInput?.value.trim() ?? "";
  nextConfig.translation.glossSelection.primaryPath = rulesConfigGlossPrimaryInput?.value.trim() ?? "";

  rulesConfigDocument = nextConfig;
  renderRulesConfigDocument();
  if (rulesConfigEditor && rulesConfigEditor.hidden === false) {
    rulesConfigEditor.value = JSON.stringify(rulesConfigDocument, null, 2);
  }
  if (rulesConfigEditorStatus) {
    rulesConfigEditorStatus.textContent = "Guided rules fields applied.";
  }
}

function formatRulesConfigEditor() {
  if (rulesConfigEditor && rulesConfigEditor.hidden === false) {
    const parsed = JSON.parse(rulesConfigEditor.value || "{}");
    rulesConfigEditor.value = JSON.stringify(parsed, null, 2);
  } else {
    rulesConfigDocument = cloneJsonDocument(rulesConfigDocument);
    renderRulesConfigDocument();
  }

  if (rulesConfigEditorStatus) {
    rulesConfigEditorStatus.textContent = "Rules JSON formatted.";
  }
}

function syncSchemaGuidedFields() {
  const schema = languagePackSchemaDocument ?? {};
  if (schemaVersionInput) {
    schemaVersionInput.value = schema.schemaVersion ?? "";
  }
  if (schemaKindInput) {
    schemaKindInput.value = schema.kind ?? "";
  }
  if (schemaDescriptionInput) {
    schemaDescriptionInput.value = schema.description ?? "";
  }
  renderSimpleListBuilder(schemaRequiredPathsBuilder, schema.rules?.requiredPaths, "language.name");
  renderSimpleListBuilder(schemaRecommendedPathsBuilder, schema.rules?.recommendedPaths, "translation.syntaxPatterns");
  renderSimpleListBuilder(schemaResolverNamesBuilder, schema.translation?.segmentResolverNames, "subject");
  renderSimpleListBuilder(schemaResolverTypesBuilder, schema.translation?.resolverTypes, "phrase");
  renderSimpleListBuilder(schemaSegmenterTypesBuilder, schema.morphology?.segmenterTypes, "affix_split");
}

function applySchemaGuidedFields() {
  const nextSchema = cloneJsonDocument(languagePackSchemaDocument);
  nextSchema.rules = nextSchema.rules ?? {};
  nextSchema.translation = nextSchema.translation ?? {};
  nextSchema.morphology = nextSchema.morphology ?? {};

  nextSchema.schemaVersion = schemaVersionInput?.value.trim() ?? "";
  nextSchema.kind = schemaKindInput?.value.trim() ?? "";
  nextSchema.description = schemaDescriptionInput?.value.trim() ?? "";
  nextSchema.rules.requiredPaths = readSimpleListBuilder(schemaRequiredPathsBuilder);
  nextSchema.rules.recommendedPaths = readSimpleListBuilder(schemaRecommendedPathsBuilder);
  nextSchema.translation.segmentResolverNames = readSimpleListBuilder(schemaResolverNamesBuilder);
  nextSchema.translation.resolverTypes = readSimpleListBuilder(schemaResolverTypesBuilder);
  nextSchema.morphology.segmenterTypes = readSimpleListBuilder(schemaSegmenterTypesBuilder);

  languagePackSchemaDocument = nextSchema;
  renderLanguagePackSchemaDocument();
  if (schemaEditor && schemaEditor.hidden === false) {
    schemaEditor.value = JSON.stringify(languagePackSchemaDocument, null, 2);
  }
  if (schemaEditorStatus) {
    schemaEditorStatus.textContent = "Guided schema fields applied.";
  }
}

function formatSchemaEditor() {
  if (schemaEditor && schemaEditor.hidden === false) {
    const parsed = JSON.parse(schemaEditor.value || "{}");
    schemaEditor.value = JSON.stringify(parsed, null, 2);
  } else {
    languagePackSchemaDocument = cloneJsonDocument(languagePackSchemaDocument);
    renderLanguagePackSchemaDocument();
  }

  if (schemaEditorStatus) {
    schemaEditorStatus.textContent = "Schema JSON formatted.";
  }
}

function syncModalOpenState() {
  const hasVisibleModal =
    lexiconEntryModal?.hidden === false ||
    lexiconGraphModal?.hidden === false ||
    languagePackModal?.hidden === false;

  document.body.classList.toggle("modal-open", hasVisibleModal);
}

function openLexiconEntryModal(entry = null) {
  if (!lexiconEntryModal || !lexiconEntryForm) {
    return;
  }

  if (!supportsFileEditing()) {
    setLexiconEditorStatus("Run start-translator.bat to edit data/lexicon.json from the app.", true);
    return;
  }

  if (entry) {
    populateLexiconEntryForm(entry);
    lexiconEntryDeleteButton.hidden = false;
    lexiconEntryStatus.textContent = "Editing an existing entry from data/lexicon.json.";
  } else {
    lexiconEntryForm.reset();
    lexiconEntryOriginalInput.value = "";
    lexiconEntryOriginalGroupInput.value = "confirmed";
    entryGroupInput.value = "confirmed";
    entryStatusInput.value = "confirmed";
    entryRegisterInput.value = "both";
    lexiconEntryDeleteButton.hidden = true;
    lexiconEntryStatus.textContent = "Creating a new entry in data/lexicon.json.";
  }

  lexiconEntryModal.hidden = false;
  syncModalOpenState();
}

function closeLexiconEntryModal() {
  if (!lexiconEntryModal) {
    return;
  }

  lexiconEntryModal.hidden = true;
  syncModalOpenState();
}

function suggestLanguagePackId(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function openLanguagePackModal() {
  if (!languagePackModal || !languagePackForm) {
    return;
  }

  if (!supportsFileEditing()) {
    setLexiconStatus("Run start-translator.bat to create language packs from the app.", true);
    return;
  }

  languagePackForm.reset();
  languagePackVersionInput.value = "0.1.0";
  languagePackActivateInput.value = "yes";
  languagePackStatus.textContent = "This creates a starter lexicon, rules config, rules notes, and schema file.";
  languagePackModal.hidden = false;
  syncModalOpenState();
  languagePackNameInput.focus();
}

function closeLanguagePackModal() {
  if (!languagePackModal) {
    return;
  }

  languagePackModal.hidden = true;
  syncModalOpenState();
}

async function saveLanguagePackFromForm() {
  if (!supportsFileEditing()) {
    setLexiconStatus("File editing requires the local server launcher.", true);
    return;
  }

  const languageName = languagePackNameInput.value.trim();
  const packId = languagePackIdInput.value.trim() || suggestLanguagePackId(languageName);
  if (!languageName) {
    languagePackStatus.textContent = "Language name is required.";
    return;
  }

  try {
    languagePackStatus.textContent = "Creating starter language pack...";
    const makeActive = languagePackActivateInput.value !== "no";
    await createLanguagePack({
      languageName,
      packId,
      version: languagePackVersionInput.value.trim() || "0.1.0",
      description: languagePackDescriptionInput.value.trim(),
      makeActive
    });
    closeLanguagePackModal();
    if (makeActive) {
      setActiveTab("rules-tab");
    }
    if (makeActive && rulesEditorStatus) {
      rulesEditorStatus.textContent = `Starter pack created for ${getActiveLanguageName()}. Use this tab to replace the starter notes with your grammar.`;
    }
  } catch (error) {
    console.error(error);
    languagePackStatus.textContent = error.message || "Could not create the language pack.";
  }
}

function populateLexiconEntryForm(entry) {
  const sourceGroup = findLexiconGroupForEntry(entry.ancient);
  lexiconEntryOriginalInput.value = entry.ancient ?? "";
  lexiconEntryOriginalGroupInput.value = sourceGroup;
  entryAncientInput.value = entry.ancient ?? "";
  entryGroupInput.value = sourceGroup;
  entryStatusInput.value = entry.status ?? sourceGroup;
  entryRegisterInput.value = entry.register ?? "";
  entryMeaningsInput.value = (entry.meanings ?? []).join("\n");
  entryPartOfSpeechInput.value = (entry.partOfSpeech ?? []).join("\n");
  entryComponentsInput.value = (entry.components ?? []).join("\n");
  entryEtymologyInput.value = (entry.etymology ?? []).join("\n");
  entryNotesInput.value = (entry.notes ?? []).join("\n");
  entryPronunciationInput.value = entry.pronunciation ?? "";
  entryLexicalizedInput.checked = Boolean(entry.lexicalized);
  entryCanDecomposeInput.checked = Boolean(entry.canDecompose);
  entryAllowNominalReadingInput.checked = Boolean(entry.allowNominalReading);
  entryOptionalInput.checked = Boolean(entry.optional);
}

function findLexiconGroupForEntry(ancient) {
  const key = normalizeAncientKey(ancient);
  if (confirmedLexicon.some((entry) => normalizeAncientKey(entry.ancient) === key)) {
    return "confirmed";
  }

  if (inferredLexicon.some((entry) => normalizeAncientKey(entry.ancient) === key)) {
    return "inferred";
  }

  return "confirmed";
}

function parseListField(value) {
  return value
    .split(/\r?\n|,/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function compactLexiconEntry(entry) {
  const cleaned = {
    ancient: entry.ancient,
    meanings: entry.meanings
  };

  for (const [key, value] of Object.entries(entry)) {
    if (key === "ancient" || key === "meanings") {
      continue;
    }

    if (Array.isArray(value) && value.length) {
      cleaned[key] = value;
      continue;
    }

    if (typeof value === "string" && value.trim()) {
      cleaned[key] = value.trim();
      continue;
    }

    if (typeof value === "boolean" && value) {
      cleaned[key] = value;
    }
  }

  return cleaned;
}

function buildLexiconEntryFromForm() {
  const ancient = entryAncientInput.value.trim();
  const meanings = parseListField(entryMeaningsInput.value);
  if (!ancient || !meanings.length) {
    throw new Error("Ancient form and at least one meaning are required.");
  }

  const group = entryGroupInput.value === "inferred" ? "inferred" : "confirmed";
  const entry = compactLexiconEntry({
    ancient,
    meanings,
    status: entryStatusInput.value.trim() || group,
    register: entryRegisterInput.value.trim(),
    partOfSpeech: parseListField(entryPartOfSpeechInput.value),
    components: parseListField(entryComponentsInput.value),
    etymology: parseListField(entryEtymologyInput.value),
    notes: parseListField(entryNotesInput.value),
    pronunciation: entryPronunciationInput.value.trim(),
    lexicalized: entryLexicalizedInput.checked,
    canDecompose: entryCanDecomposeInput.checked,
    allowNominalReading: entryAllowNominalReadingInput.checked,
    optional: entryOptionalInput.checked
  });

  return { group, entry };
}

function getWritableLexiconPayload() {
  return {
    confirmed: confirmedLexicon.map(cloneLexiconEntry),
    inferred: inferredLexicon.map(cloneLexiconEntry)
  };
}

async function saveLexiconEntryFromForm() {
  if (!supportsFileEditing()) {
    setLexiconEditorStatus("File editing requires the local server launcher.", true);
    return;
  }

  try {
    const { group, entry } = buildLexiconEntryFromForm();
    const originalAncient = lexiconEntryOriginalInput.value.trim();
    const originalGroup = lexiconEntryOriginalGroupInput.value.trim() || "confirmed";
    const payload = getWritableLexiconPayload();
    const normalizedNew = normalizeAncientKey(entry.ancient);

    for (const bucketName of ["confirmed", "inferred"]) {
      payload[bucketName] = payload[bucketName].filter((candidate) => {
        const sameOriginal =
          bucketName === originalGroup &&
          normalizeAncientKey(candidate.ancient) === normalizeAncientKey(originalAncient);
        return !sameOriginal;
      });
    }

    const duplicate = payload[group].some((candidate) => normalizeAncientKey(candidate.ancient) === normalizedNew);
    if (duplicate) {
      throw new Error("Another entry already uses that Ancient form in the target group.");
    }

    payload[group].push(entry);
    payload[group].sort((left, right) => left.ancient.localeCompare(right.ancient));
    await saveLexiconPayload(payload);
    selectedLexiconHeadword = entry.ancient;
    closeLexiconEntryModal();
    setLexiconEditorStatus(`Saved ${entry.ancient} to ${getActiveLexiconPath()}.`);
  } catch (error) {
    console.error(error);
    lexiconEntryStatus.textContent = error.message || "Could not save the lexicon entry.";
    setLexiconEditorStatus(error.message || "Could not save the lexicon entry.", true);
  }
}

async function deleteLexiconEntry(ancient, group) {
  try {
    const payload = getWritableLexiconPayload();
    const normalizedAncient = normalizeAncientKey(ancient);
    const before = payload[group]?.length ?? 0;
    payload[group] = (payload[group] ?? []).filter(
      (entry) => normalizeAncientKey(entry.ancient) !== normalizedAncient
    );

    if ((payload[group]?.length ?? 0) === before) {
      throw new Error("Could not find that entry to delete.");
    }

    await saveLexiconPayload(payload);
    if (normalizeAncientKey(selectedLexiconHeadword ?? "") === normalizedAncient) {
      selectedLexiconHeadword = activeLexicon[0]?.ancient ?? null;
    }
    closeLexiconEntryModal();
    setLexiconEditorStatus(`Deleted ${ancient} from ${getActiveLexiconPath()}.`);
  } catch (error) {
    console.error(error);
    lexiconEntryStatus.textContent = error.message || "Could not delete the lexicon entry.";
    setLexiconEditorStatus(error.message || "Could not delete the lexicon entry.", true);
  }
}

async function saveLexiconPayload(payload) {
  const response = await fetch("./api/lexicon", {
    method: "PUT",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(normalizeLexiconPayload(payload))
  });

  if (!response.ok) {
    throw new Error(`Could not save ${getActiveLexiconPath()} (HTTP ${response.status}).`);
  }

  const savedPayload = await response.json();
  applyLexiconPayload(savedPayload);
  rerenderActiveSource();
}

function closeRulesEditor() {
  if (!rulesEditor || !rulesContent) {
    return;
  }

  rulesEditor.hidden = true;
  rulesContent.hidden = false;
  rulesEditorDirty = false;
  renderRulesNotes();
}

async function saveRulesNotesMarkdown() {
  if (!supportsFileEditing()) {
    if (rulesEditorStatus) {
      rulesEditorStatus.textContent = "File editing requires the local server launcher.";
    }
    return;
  }

  try {
    const value = rulesEditor?.value ?? "";
    const response = await fetch("./api/rules-notes", {
      method: "PUT",
      headers: {
        "Content-Type": "text/markdown;charset=utf-8"
      },
      body: value
    });

    if (!response.ok) {
      throw new Error(`Could not save ${getActiveRulesNotesPath()} (HTTP ${response.status}).`);
    }

    const savedMarkdown = await response.text();
    applyRulesNotesMarkdown(savedMarkdown);
    closeRulesEditor();
    if (rulesEditorStatus) {
      rulesEditorStatus.textContent = `Saved ${getActiveRulesNotesPath()}.`;
    }
  } catch (error) {
    console.error(error);
    if (rulesEditorStatus) {
      rulesEditorStatus.textContent = error.message || `Could not save ${getActiveRulesNotesPath()}.`;
    }
  }
}

function closeRulesConfigEditor() {
  if (!rulesConfigEditor || !rulesConfigContent) {
    return;
  }

  rulesConfigEditor.hidden = true;
  rulesConfigContent.hidden = false;
  rulesConfigEditButton.hidden = false;
  rulesConfigSaveButton.hidden = true;
  rulesConfigCancelButton.hidden = true;
  rulesConfigEditorDirty = false;
  renderRulesConfigDocument();
}

async function saveRulesConfigDocument() {
  if (!supportsFileEditing()) {
    if (rulesConfigEditorStatus) {
      rulesConfigEditorStatus.textContent = "File editing requires the local server launcher.";
    }
    return;
  }

  try {
    const value = rulesConfigEditor?.hidden === false
      ? (rulesConfigEditor?.value ?? "")
      : JSON.stringify(rulesConfigDocument ?? {}, null, 2);
    const response = await fetch("./api/rules-config", {
      method: "PUT",
      headers: {
        "Content-Type": "application/json"
      },
      body: value
    });

    if (!response.ok) {
      throw new Error(`Could not save ${getActiveRulesConfigPath()} (HTTP ${response.status}).`);
    }

    const savedReport = await response.json();
    rulesConfigDocument = savedReport?.config ?? {};
    rulesConfigPath = savedReport?.path || getActiveRulesConfigPath();
    applyLanguageRulesConfig(rulesConfigDocument);
    renderRulesConfigDocument();
    syncActiveLanguageWorkspace();
    rerenderActiveSource();
    closeRulesConfigEditor();
    if (rulesConfigEditorStatus) {
      rulesConfigEditorStatus.textContent = `Saved ${getActiveRulesConfigPath()}.`;
    }
  } catch (error) {
    console.error(error);
    if (rulesConfigEditorStatus) {
      rulesConfigEditorStatus.textContent = error.message || `Could not save ${getActiveRulesConfigPath()}.`;
    }
  }
}

function closeSchemaEditor() {
  if (!schemaEditor || !schemaContent) {
    return;
  }

  schemaEditor.hidden = true;
  schemaContent.hidden = false;
  schemaEditButton.hidden = false;
  schemaSaveButton.hidden = true;
  schemaCancelButton.hidden = true;
  schemaEditorDirty = false;
  renderLanguagePackSchemaDocument();
}

async function saveLanguagePackSchemaDocument() {
  if (!supportsFileEditing()) {
    if (schemaEditorStatus) {
      schemaEditorStatus.textContent = "File editing requires the local server launcher.";
    }
    return;
  }

  try {
    const value = schemaEditor?.hidden === false
      ? (schemaEditor?.value ?? "")
      : JSON.stringify(languagePackSchemaDocument ?? {}, null, 2);
    const response = await fetch("./api/language-pack-schema", {
      method: "PUT",
      headers: {
        "Content-Type": "application/json"
      },
      body: value
    });

    if (!response.ok) {
      throw new Error(`Could not save ${getActiveSchemaPath()} (HTTP ${response.status}).`);
    }

    const savedReport = await response.json();
    languagePackSchemaDocument = savedReport?.schema ?? {};
    languagePackSchemaDocumentPath = savedReport?.path || getActiveSchemaPath();
    renderLanguagePackSchemaDocument();
    closeSchemaEditor();
    if (schemaEditorStatus) {
      schemaEditorStatus.textContent = `Saved ${getActiveSchemaPath()}.`;
    }
  } catch (error) {
    console.error(error);
    if (schemaEditorStatus) {
      schemaEditorStatus.textContent = error.message || `Could not save ${getActiveSchemaPath()}.`;
    }
  }
}
