// Workspace data loading, lexicon state, and shared tab helpers.

async function initializeApp() {
  try {
    if (window.location.protocol === "file:") {
      setLexiconStatus("Local file mode detected. Import JSON or use the local server launcher.");
    } else {
      setLexiconStatus("Loading data/lexicon.json...");
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
    appReady = true;
    setLexiconStatus(describeActiveLexiconSource());

    englishInput.value = "bring ruin, bring ruin\nour lives are yours";
    englishInput.dispatchEvent(new Event("input"));
  } catch (error) {
    console.error(error);
    setLexiconStatus(
      window.location.protocol === "file:"
        ? "Browser file mode blocked automatic JSON loading. Import JSON or use the local server launcher."
        : "Lexicon failed to load. Import a JSON lexicon to continue.",
      true
    );
    translatorNote.textContent =
      window.location.protocol === "file:"
        ? "Open the app through the local server launcher or import a JSON lexicon file to start translating."
        : "Import a lexicon JSON file to start translating.";
  }
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

  return value.map(cloneLexiconEntry);
}

function cloneLexiconEntry(entry) {
  if (!entry || typeof entry !== "object") {
    return {
      ancient: "",
      meanings: []
    };
  }

  return {
    ...entry,
    meanings: Array.isArray(entry.meanings) ? [...entry.meanings] : [],
    partOfSpeech: Array.isArray(entry.partOfSpeech) ? [...entry.partOfSpeech] : [],
    components: Array.isArray(entry.components) ? [...entry.components] : [],
    etymology: Array.isArray(entry.etymology) ? [...entry.etymology] : [],
    notes: Array.isArray(entry.notes) ? [...entry.notes] : []
  };
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
    return "Using imported lexicon JSON from browser storage.";
  }

  return "Using data/lexicon.json with local file save support.";
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

  englishToAncient = buildEnglishToAncientMap(activeLexicon);
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
    console.warn("API lexicon loading failed, trying static JSON.", error);
  }

  try {
    const response = await fetch("./data/lexicon.json", { cache: "no-store" });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    return response.json();
  } catch (error) {
    const stored = readPersistedLexicon();
    if (stored) {
      return stored;
    }

    throw error;
  }
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
    console.warn("API rules loading failed, trying static markdown.", error);
  }

  const fallback = await fetch("./data/rules-notes.md", { cache: "no-store" });
  if (!fallback.ok) {
    throw new Error(`HTTP ${fallback.status}`);
  }

  return fallback.text();
}

