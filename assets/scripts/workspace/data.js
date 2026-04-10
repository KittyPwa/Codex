// Workspace data loading, lexicon state, and shared tab helpers.

async function initializeApp() {
  try {
    if (window.location.protocol === "file:") {
      setLexiconStatus("Local file mode detected. Translation requires the local server launcher.");
    } else {
      setLexiconStatus("Loading backend-managed lexicon and rules...");
      await loadLanguagePackRegistry();
    }

    await reloadWorkspaceData();
    serverTranslationApiAvailable = await probeTranslationApi();
    if (window.location.protocol !== "file:" && !serverTranslationApiAvailable) {
      throw new Error(getTranslationApiStatusMessage());
    }
    appReady = true;
    setLexiconStatus(describeActiveLexiconSource());

    const initialEnglishSample = getDefaultEnglishSample();
    if (initialEnglishSample) {
      englishInput.value = initialEnglishSample;
      englishInput.dispatchEvent(new Event("input"));
    } else {
      resetTranslationWorkspace({
        preserveInputs: true,
        note: `Ready for ${getActiveLanguageName()}. Enter English or ${getActiveLanguageName()} text to begin.`
      });
    }
  } catch (error) {
    console.error(error);
    setLexiconStatus(
      window.location.protocol === "file:"
        ? "Browser file mode cannot use the translator. Open the app through the local server launcher."
        : "Lexicon failed to load. Import a JSON lexicon to continue.",
      true
    );
    translatorNote.textContent =
      window.location.protocol === "file:"
        ? "Open the app through the local server launcher to use translation, editing, and export features."
        : error.message || "Restart the local server or import a lexicon JSON file to recover the workspace.";
  }
}

async function reloadWorkspaceData() {
  let rulesConfig = {};
  try {
    rulesConfig = await loadRulesConfig();
    applyLanguageRulesConfig(rulesConfig);
    rulesConfigSource = "backend rules config";
  } catch (rulesConfigError) {
    console.warn("Rules JSON could not be loaded. Falling back to generic empty defaults.", rulesConfigError);
    applyLanguageRulesConfig({});
    rulesConfigSource = "generic empty defaults";
  }

  const payload = await loadLexiconPayload();
  applyLexiconPayload(payload);

  try {
    const rulesMarkdown = await loadRulesNotesMarkdown();
    applyRulesNotesMarkdown(rulesMarkdown);
  } catch (rulesError) {
    console.warn("Rules and notes file could not be loaded.", rulesError);
    applyRulesNotesMarkdown("");
  }

  if (window.location.protocol !== "file:") {
    activeLanguagePackStatus = await loadLanguagePackStatus();
    activeLanguagePackId = activeLanguagePackStatus?.packId || activeLanguagePackId;
    syncLanguagePackSelect();
  }

  syncActiveLanguageWorkspace();
}

function applyLexiconPayload(payload) {
  lexiconSourcePayload = normalizeLexiconPayload(payload);

  if (Array.isArray(payload)) {
    confirmedLexicon = normalizeLexiconEntries(payload);
    inferredLexicon = [];
  } else {
    confirmedLexicon = normalizeLexiconEntries(payload?.confirmed);
    inferredLexicon = normalizeLexiconEntries(payload?.inferred);
  }

  if (!confirmedLexicon.length) {
    throw new Error("The lexicon JSON must include at least one confirmed entry.");
  }

  refreshLexiconState();
  if (!selectedLexiconHeadword || !lookupEntry(selectedLexiconHeadword)) {
    selectedLexiconHeadword = activeLexicon[0]?.ancient ?? null;
  }
  populateLexiconFilters();
  renderLexiconTable();
  renderLexiconGraph();
}

function applyRulesNotesMarkdown(markdown) {
  rulesNotesMarkdown = markdown.trim();
  renderRulesNotes();
}

function normalizeLexiconPayload(payload) {
  if (Array.isArray(payload)) {
    return {
      confirmed: normalizeLexiconEntries(payload).map(cloneLexiconEntry),
      inferred: []
    };
  }

  return {
    confirmed: normalizeLexiconEntries(payload?.confirmed).map(cloneLexiconEntry),
    inferred: normalizeLexiconEntries(payload?.inferred).map(cloneLexiconEntry)
  };
}

function normalizeLexiconEntries(value) {
  if (!Array.isArray(value)) {
    return [];
  }

  if (
    value.length === 1 &&
    value[0] &&
    typeof value[0] === "object" &&
    Array.isArray(value[0].value)
  ) {
    return value[0].value;
  }

  return value.map((entry) => normalizeLexiconEntryForFrontend(entry));
}

function getLexiconFieldPath(fieldName) {
  const defaults = {
    headword: "ancient",
    meanings: "meanings",
    status: "status",
    register: "register",
    components: "components",
    etymology: "etymology",
    notes: "notes",
    pronunciation: "pronunciation",
    lexicalized: "lexicalized",
    allowNominalReading: "allowNominalReading",
    partOfSpeech: "partOfSpeech"
  };

  return languageRulesConfig?.lexicon?.fieldMap?.[fieldName] || defaults[fieldName] || "";
}

function getEntryValueByPath(entry, path, fallback = undefined) {
  if (!entry || typeof entry !== "object" || !path) {
    return fallback;
  }

  let current = entry;
  for (const segment of String(path).split(".")) {
    if (current === null || current === undefined) {
      return fallback;
    }

    current = current[segment];
  }

  return current === undefined ? fallback : current;
}

function normalizeEntryArrayValue(value) {
  if (Array.isArray(value)) {
    return [...value];
  }

  if (value === null || value === undefined || value === "") {
    return [];
  }

  return [value];
}

function normalizeLexiconEntryForFrontend(entry) {
  if (!entry || typeof entry !== "object") {
    return {
      ancient: "",
      meanings: []
    };
  }

  const headword = getEntryValueByPath(entry, getLexiconFieldPath("headword"), entry.ancient ?? "");
  const meanings = getEntryValueByPath(entry, getLexiconFieldPath("meanings"), entry.meanings ?? []);
  const status = getEntryValueByPath(entry, getLexiconFieldPath("status"), entry.status ?? "");
  const register = getEntryValueByPath(entry, getLexiconFieldPath("register"), entry.register ?? "");
  const components = getEntryValueByPath(entry, getLexiconFieldPath("components"), entry.components ?? []);
  const etymology = getEntryValueByPath(entry, getLexiconFieldPath("etymology"), entry.etymology ?? []);
  const notes = getEntryValueByPath(entry, getLexiconFieldPath("notes"), entry.notes ?? []);
  const pronunciation = getEntryValueByPath(entry, getLexiconFieldPath("pronunciation"), entry.pronunciation ?? "");
  const lexicalized = getEntryValueByPath(entry, getLexiconFieldPath("lexicalized"), entry.lexicalized ?? false);
  const allowNominalReading = getEntryValueByPath(entry, getLexiconFieldPath("allowNominalReading"), entry.allowNominalReading ?? false);
  const partOfSpeech = getEntryValueByPath(entry, getLexiconFieldPath("partOfSpeech"), entry.partOfSpeech ?? []);

  return {
    ...entry,
    ancient: String(headword ?? ""),
    meanings: normalizeEntryArrayValue(meanings).map((item) => String(item ?? "")),
    status: String(status ?? ""),
    register: String(register ?? ""),
    partOfSpeech: normalizeEntryArrayValue(partOfSpeech).map((item) => String(item ?? "")),
    components: normalizeEntryArrayValue(components).map((item) => String(item ?? "")),
    etymology: normalizeEntryArrayValue(etymology).map((item) => String(item ?? "")),
    notes: normalizeEntryArrayValue(notes).map((item) => String(item ?? "")),
    pronunciation: String(pronunciation ?? ""),
    lexicalized: Boolean(lexicalized),
    allowNominalReading: Boolean(allowNominalReading)
  };
}

function cloneLexiconEntry(entry) {
  return normalizeLexiconEntryForFrontend(entry);
}

function persistImportedLexicon(payload) {
  try {
    window.localStorage.setItem("ancientTongueLexiconJson", JSON.stringify(payload));
  } catch (error) {
    console.warn("Could not persist imported lexicon JSON.", error);
  }
}

function readPersistedLexicon() {
  try {
    const raw = window.localStorage.getItem("ancientTongueLexiconJson");
    return raw ? JSON.parse(raw) : null;
  } catch (error) {
    console.warn("Could not read persisted lexicon JSON.", error);
    return null;
  }
}

function setLexiconStatus(message, isError = false) {
  if (!lexiconStatus) {
    return;
  }

  lexiconStatus.textContent = message;
  lexiconStatus.dataset.state = isError ? "error" : "ready";
}

function setActiveTab(targetId) {
  for (const button of tabButtons) {
    button.classList.toggle("is-active", button.dataset.tabTarget === targetId);
  }

  for (const panel of tabPanels) {
    panel.classList.toggle("is-active", panel.id === targetId);
  }
}

function describeActiveLexiconSource() {
  if (window.location.protocol === "file:") {
    return "File mode is open. Translation is disabled until the local server is used.";
  }

  const activePack = availableLanguagePacks.find((pack) => pack.id === activeLanguagePackId);
  const packName = activePack?.language?.name || activeLanguagePackStatus?.language?.name || "loaded pack";
  return `Using backend-managed lexicon for ${packName} and ${rulesConfigSource ?? "built-in rules"} with translator API.`;
}

function syncActiveLanguageWorkspace() {
  const languageName = getActiveLanguageName();

  if (loadedLanguageTitle) {
    loadedLanguageTitle.textContent = languageName;
  }

  if (loadedLanguageInputLabel) {
    loadedLanguageInputLabel.textContent = `${languageName} input`;
  }

  if (ancientInput) {
    ancientInput.placeholder = `Write in ${languageName} here...`;
  }

  if (!appReady || (!ancientInput.value.trim() && !englishInput.value.trim())) {
    resetTranslationWorkspace({
      preserveInputs: true,
      note: `Ready for ${languageName}. Enter English or ${languageName} text to begin.`
    });
  }
}

function resetTranslationWorkspace(options = {}) {
  const preserveInputs = Boolean(options.preserveInputs);
  const languageName = getActiveLanguageName();

  translationRequestSequence += 1;
  activeSource = null;

  if (!preserveInputs) {
    englishInput.value = "";
    ancientInput.value = "";
  }

  glossSummary.textContent = `Type ${languageName} to see structured glossing.`;
  translatorNote.textContent = options.note || `Ready for ${languageName}. Enter English or ${languageName} text to begin.`;
  morphemeOutput.textContent = `Type ${languageName} to see line glosses.`;
  literalOutput.textContent = `Type ${languageName} to see resolved lexical gloss.`;
  idiomaticOutput.textContent = `Type ${languageName} to see idiomatic line translations.`;
  analysisList.innerHTML = "";
}

function rerenderActiveSource() {
  if (!appReady) {
    return;
  }

  if (ancientInput.value.trim()) {
    ancientInput.dispatchEvent(new Event("input"));
    return;
  }

  if (englishInput.value.trim()) {
    englishInput.dispatchEvent(new Event("input"));
  }
}

function refreshLexiconState() {
  activeLexicon = includeInferredToggle.checked
    ? [...confirmedLexicon, ...inferredLexicon]
    : confirmedLexicon;

  lexiconByAncient = new Map(
    activeLexicon.map((entry) => [normalizeAncientKey(entry.ancient), entry])
  );
}

function populateLexiconFilters() {
  populateSelect(lexiconStatusFilter, collectLexiconValues((entry) => entry.status ?? "confirmed"));
  populateSelect(lexiconRegisterFilter, collectLexiconValues((entry) => entry.register ?? "unspecified"));
  populateSelect(lexiconCategoryFilter, collectLexiconCategories());
}

function populateSelect(select, values) {
  if (!select) {
    return;
  }

  const current = select.value || "all";
  select.innerHTML = "";

  const allOption = document.createElement("option");
  allOption.value = "all";
  allOption.textContent = "All";
  select.append(allOption);

  for (const value of values) {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = value;
    select.append(option);
  }

  select.value = values.includes(current) ? current : "all";
}

function collectLexiconValues(getValue) {
  return Array.from(new Set(activeLexicon.map(getValue).filter(Boolean))).sort((left, right) => left.localeCompare(right));
}

function collectLexiconCategories() {
  const categories = new Set();

  for (const entry of activeLexicon) {
    for (const category of getLexiconCategories(entry)) {
      categories.add(category);
    }
  }

  return Array.from(categories).sort((left, right) => left.localeCompare(right));
}

function getLexiconCategories(entry) {
  const categories = new Set(entry.partOfSpeech ?? []);

  if (entry.lexicalized) {
    categories.add("lexicalized");
  }

  if (entry.components?.length) {
    categories.add("compound");
  }

  if (!categories.size) {
    categories.add("root");
  }

  return Array.from(categories);
}


async function loadLexiconPayload() {
  if (window.location.protocol === "file:") {
    const stored = readPersistedLexicon();
    if (stored) {
      return stored;
    }

    throw new Error("Automatic JSON loading is blocked under file:// in this browser.");
  }

  try {
    const response = await fetch("./api/lexicon", { cache: "no-store" });
    if (response.ok) {
      return response.json();
    }
  } catch (error) {
    console.warn("API lexicon loading failed.", error);
  }

  {
    const stored = readPersistedLexicon();
    if (stored) {
      return stored;
    }

    throw new Error("Lexicon API failed to load.");
  }
}

async function loadLanguagePackRegistry() {
  const response = await fetch("./api/language-packs", { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`Language packs API failed to load with HTTP ${response.status}.`);
  }

  const payload = await response.json();
  availableLanguagePacks = Array.isArray(payload?.packs) ? payload.packs : [];
  activeLanguagePackId = payload?.activePackId || availableLanguagePacks.find((pack) => pack.active)?.id || "default";
  syncLanguagePackSelect();
  return payload;
}

async function loadLanguagePackStatus() {
  const response = await fetch("./api/language-pack", { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`Language pack API failed to load with HTTP ${response.status}.`);
  }

  return response.json();
}

function syncLanguagePackSelect() {
  if (!languagePackSelect) {
    return;
  }

  languagePackSelect.innerHTML = "";

  for (const pack of availableLanguagePacks) {
    const option = document.createElement("option");
    option.value = pack.id;
    option.textContent = pack.language?.name || pack.label || pack.id;
    languagePackSelect.append(option);
  }

  if (!availableLanguagePacks.length) {
    const option = document.createElement("option");
    option.value = "";
    option.textContent = "No packs available";
    languagePackSelect.append(option);
  }

  languagePackSelect.value = activeLanguagePackId;
  languagePackSelect.disabled = window.location.protocol === "file:" || availableLanguagePacks.length <= 1;
}

async function switchLanguagePack(packId) {
  if (window.location.protocol === "file:") {
    return;
  }

  const response = await fetch("./api/language-pack", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ packId })
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => "");
    throw new Error(errorText || `Language pack switch failed with HTTP ${response.status}.`);
  }

  activeLanguagePackStatus = await response.json();
  activeLanguagePackId = activeLanguagePackStatus?.packId || packId;
  await loadLanguagePackRegistry();
  await reloadWorkspaceData();
  serverTranslationApiAvailable = await probeTranslationApi();
  setLexiconStatus(describeActiveLexiconSource());
  resetTranslationWorkspace({
    note: `Switched to ${getActiveLanguageName()}. Enter fresh text for this language pack.`
  });
}

async function loadRulesNotesMarkdown() {
  if (window.location.protocol === "file:") {
    return "";
  }

  try {
    const response = await fetch("./api/rules-notes", { cache: "no-store" });
    if (response.ok) {
      return response.text();
    }
  } catch (error) {
    console.warn("API rules-notes loading failed.", error);
  }

  throw new Error("Rules & notes API failed to load.");
}

async function loadRulesConfig() {
  if (window.location.protocol === "file:") {
    return {};
  }

  const response = await fetch("./api/rules-config", { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`Rules config API failed to load with HTTP ${response.status}.`);
  }

  return response.json();
}

