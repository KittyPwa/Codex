let confirmedLexicon = [];
let inferredLexicon = [];

const englishInput = document.querySelector("#english-input");
const ancientInput = document.querySelector("#ancient-input");
const fillEnglishButton = document.querySelector("#fill-english");
const fillAncientButton = document.querySelector("#fill-ancient");
const analysisList = document.querySelector("#analysis-list");
const glossSummary = document.querySelector("#gloss-summary");
const translatorNote = document.querySelector("#translator-note");
const includeInferredToggle = document.querySelector("#include-inferred");
const outputModeSelect = document.querySelector("#output-mode");
const lexiconStatus = document.querySelector("#lexicon-status");
const lexiconFileInput = document.querySelector("#lexicon-file");
const downloadLexiconMarkdownButton = document.querySelector("#download-lexicon-md");
const tabButtons = Array.from(document.querySelectorAll("[data-tab-target]"));
const tabPanels = Array.from(document.querySelectorAll(".tab-panel"));
const lexiconTableSummary = document.querySelector("#lexicon-table-summary");
const lexiconSearchInput = document.querySelector("#lexicon-search");
const lexiconStatusFilter = document.querySelector("#lexicon-status-filter");
const lexiconRegisterFilter = document.querySelector("#lexicon-register-filter");
const lexiconCategoryFilter = document.querySelector("#lexicon-category-filter");
const lexiconTableBody = document.querySelector("#lexicon-table-body");
const lexiconSortButtons = Array.from(document.querySelectorAll("[data-lexicon-sort]"));
const lexiconNewEntryButton = document.querySelector("#lexicon-new-entry");
const lexiconEditorStatus = document.querySelector("#lexicon-editor-status");
const lexiconGraphModal = document.querySelector("#lexicon-graph-modal");
const lexiconGraphBackdrop = document.querySelector("#lexicon-graph-backdrop");
const lexiconGraphCloseButton = document.querySelector("#lexicon-graph-close");
const lexiconGraphSummary = document.querySelector("#lexicon-graph-summary");
const lexiconGraphRoot = document.querySelector("#lexicon-graph-root");
const lexiconEntryModal = document.querySelector("#lexicon-entry-modal");
const lexiconEntryBackdrop = document.querySelector("#lexicon-entry-backdrop");
const lexiconEntryForm = document.querySelector("#lexicon-entry-form");
const lexiconEntryDeleteButton = document.querySelector("#lexicon-entry-delete");
const lexiconEntryCancelButton = document.querySelector("#lexicon-entry-cancel");
const lexiconEntryStatus = document.querySelector("#lexicon-entry-status");
const lexiconEntryOriginalInput = document.querySelector("#lexicon-entry-original");
const lexiconEntryOriginalGroupInput = document.querySelector("#lexicon-entry-original-group");
const entryAncientInput = document.querySelector("#entry-ancient");
const entryGroupInput = document.querySelector("#entry-group");
const entryStatusInput = document.querySelector("#entry-status");
const entryRegisterInput = document.querySelector("#entry-register");
const entryMeaningsInput = document.querySelector("#entry-meanings");
const entryPartOfSpeechInput = document.querySelector("#entry-part-of-speech");
const entryComponentsInput = document.querySelector("#entry-components");
const entryEtymologyInput = document.querySelector("#entry-etymology");
const entryNotesInput = document.querySelector("#entry-notes");
const entryPronunciationInput = document.querySelector("#entry-pronunciation");
const entryLexicalizedInput = document.querySelector("#entry-lexicalized");
const entryCanDecomposeInput = document.querySelector("#entry-can-decompose");
const entryAllowNominalReadingInput = document.querySelector("#entry-allow-nominal-reading");
const entryOptionalInput = document.querySelector("#entry-optional");
const rulesSummary = document.querySelector("#rules-summary");
const rulesContent = document.querySelector("#rules-content");
const rulesEditButton = document.querySelector("#rules-edit-button");
const rulesSaveButton = document.querySelector("#rules-save-button");
const rulesCancelButton = document.querySelector("#rules-cancel-button");
const rulesEditorStatus = document.querySelector("#rules-editor-status");
const rulesEditor = document.querySelector("#rules-editor");
const morphemeOutput = document.querySelector("#morpheme-output");
const literalOutput = document.querySelector("#literal-output");
const idiomaticOutput = document.querySelector("#idiomatic-output");

const MARKDOWN_SECTION_ORDER = [
  "Grammar Markers",
  "Core Verbs",
  "Perception, Relation, and Core Concepts",
  "Motion and Force",
  "Conflict and Survival",
  "Direction and Space",
  "Number and Quantity",
  "Time",
  "Celestial and Natural Elements",
  "Body and Being",
  "Mind, Knowledge, and Spirit",
  "Emotion",
  "People and Social Structure",
  "Change, Learning, and Relation",
  "Qualities and Abstract Oppositions",
  "Ritual and Liturgical Forms",
  "Inferred / Etymological Roots",
  "Additional Entries"
];

const MARKDOWN_SECTION_SETS = {
  "Grammar Markers": new Set(["ar", "en", "'s", "eh", "i"]),
  "Core Verbs": new Set(["sul", "sal", "tsich", "tsach", "mel", "mal", "nocht", "tsocht", "tsecht", "la", "licht", "lin", "lan", "socht", "sacht", "tchich", "ta"]),
  "Perception, Relation, and Core Concepts": new Set(["tcha", "kecht", "nuhl", "ru", "soo", "teal", "neal", "val", "rel", "kol", "nal", "koa", "tso", "tsacht", "tsol"]),
  "Motion and Force": new Set(["tik", "ri", "ren", "reh", "rez", "ro", "rok", "rocht", "tal", "tocht"]),
  "Conflict and Survival": new Set(["vik", "vicht", "valtsoum", "sult", "zicht", "xok", "zir", "zik"]),
  "Direction and Space": new Set(["ji", "jo", "ja", "ja's", "rek", "rak", "raknacht", "to", "sulneh", "neh", "jija", "jino", "ouk", "oun", "xi"]),
  "Number and Quantity": new Set(["ni", "no", "kei", "valkei"]),
  "Time": new Set(["tacht", "nacht", "tem", "sitacht", "sinacht", "let", "lak", "locht"]),
  "Celestial and Natural Elements": new Set(["tsar", "tsin", "tsen", "ko", "ka", "hesh", "hwir", "hoc", "sec", "sesh", "tsal", "sachthoc", "tsecht lietacht", "heshtsali", "hocsesh", "rekwir", "zok"]),
  "Body and Being": new Set(["kesh", "keshir", "keshoc", "kesheh", "keshti", "ti", "heshtsoum", "naltsoum", "reksacht", "rektchich"]),
  "Mind, Knowledge, and Spirit": new Set(["vacht", "nila", "valka", "soolie", "titsoum", "lietacht", "ruval", "rutacht", "linru", "linvacht", "ruvalnacht", "nachtnuh", "nuh", "nu", "soh", "sicht", "valkecht", "nachtvacht", "heshvacht"]),
  "Emotion": new Set(["nuhzik", "nuhtsecht", "tihesh", "nutsoum", "valtsecht", "sizir", "nuhzir", "sizik", "tar", "rektsecht"]),
  "People and Social Structure": new Set(["mah", "tah", "kesh'skeh", "kesh'skehsi", "sikeshi", "valkesh", "cheechtkesh", "nuhkesh", "chi", "sachtchi", "ta'sikeshi", "sachtsoum", "sitsoum", "yeket"]),
  "Change, Learning, and Relation": new Set(["tasacht", "tasi", "tavalge", "nochtno", "nochtni", "nochtsi", "tsi", "tichtsi", "tichti", "tasachtsoum", "zecht", "zoh", "go", "ge"]),
  "Qualities and Abstract Oppositions": new Set(["cheecht", "loo", "si", "sacht", "acht", "ocht", "ohm", "uhm", "ocho"]),
  "Ritual and Liturgical Forms": new Set(["tso'koa"]),
  "Inferred / Etymological Roots": new Set(["yecht"])
};

const ENGLISH_FILLERS = new Set(["the", "a", "an"]);
const PRODUCTIVE_SUFFIXES = ["'s", "eh", "i", "ar", "en"];
const AFFIX_MEANINGS = {
  "'s": ["direction", "intent toward", "toward"],
  eh: ["possession", "belonging"],
  i: ["plural denominator", "plural"],
  ar: ["agent marker", "actor"],
  en: ["object marker"]
};
const NORMALIZATION_MAP = {
  nach: "nacht",
  teeleh: "tealeh",
  neali: "neal+i",
  tealeh: "teal+eh",
  yeketeh: "yeket+eh",
  "koa's": "koa+'s",
  "rel's": "rel+'s",
  "tsecht's": "tsecht+'s",
  "kesh'skehsiar": "kesh'skehsi+ar",
  "mah-ar": "mah+ar",
  "tah-ar": "tah+ar",
  "tso'koa": "tso'koa",
  "tso’koa": "tso'koa",
  tsokoa: "tso'koa",
  nali: "nal+i"
};
const CONTEXTUAL_RENDERINGS = {
  "neal+i": ["we", "our", "our lives"],
  "teal+eh": ["your", "yours", "belonging to you"],
  "yeket+eh": ["your children"],
  "val+rel": ["do not harm", "no harm"],
  "tso+neal+i+tsacht": ["give us peace"]
};
const LEXICAL_COMPOUNDS = {
  "si+tacht": "before",
  "si+nacht": "after",
  "val+kecht": "silence",
  "nacht+nuh": "fate",
  "val+kei": "few",
  "kesh+'s+keh": "kin",
  "kesh+'s+keh+si": "tribe",
  "kesh+'s+keh+si+ar": "tribe + agent marker",
  "ru+val+nacht": "omen"
};
const PHRASE_RENDERINGS = {
  "neal+i": "we",
  "teal+eh": "your",
  "kesh+'s+keh+si+ar": "our tribe",
  "mah+ar": "mother",
  "tah+ar": "father",
  "ru+val+nacht": "omen",
  "nacht+nuh": "fate",
  "val+kei": "few"
};
const LEXICAL_PRIORITY = new Set([
  "tso'koa",
  "yeket",
  "valkesh",
  "nuhkesh",
  "ruvalnacht",
  "raknacht",
  "valkecht",
  "kesh'skeh",
  "kesh'skehsi"
]);
const HIDDEN_TRANSLATION_MARKERS = new Set(["ar", "en", "'s", "eh", "i"]);
const ARTICLE_BLOCKERS = new Set([
  "before",
  "after",
  "always",
  "never",
  "once",
  "here",
  "there"
]);
const ARTICLE_EXCEPTIONS = new Set([
  "sun",
  "moon",
  "day",
  "night",
  "wind",
  "sand",
  "sky"
]);
const NARRATIVE_RENDERINGS = {
  licht: { narrative: "remained", literal: "remain" },
  lan: { narrative: "appeared", literal: "appear" },
  lin: { narrative: "vanished", literal: "vanish" },
  sal: { narrative: "came", literal: "come" },
  socht: { narrative: "began", literal: "begin" },
  sacht: { narrative: "continued", literal: "continue" },
  ru: { narrative: "knew", literal: "know" },
  rutacht: { narrative: "remembered", literal: "remember" },
  tsach: { narrative: "gave", literal: "give" },
  tsocht: { narrative: "kept", literal: "keep" },
  kecht: { narrative: "heard", literal: "hear" },
  la: { narrative: "was", literal: "be" }
};

const CLAUSE_TYPES = {
  lan: "appearance",
  licht: "state",
  lin: "state",
  la: "state",
  sal: "motion",
  sul: "motion",
  sacht: "motion",
  ru: "knowledge",
  rutacht: "knowledge",
  kecht: "perception",
  tsach: "action",
  tsocht: "action"
};

const POETIC_OVERRIDES = new Map([
  ["tso'koa, tso'koa", "Bring ruin, bring ruin"],
  ["neali micht tealeh", "Our lives are yours"],
  ["neali micht teeleh", "Our lives are yours"],
  ["neali tso nach tealeh", "We give you our future"],
  ["neali tso nach teeleh", "We give you our future"],
  ["tealeh sesh vata kol", "Your winds blind all"],
  ["teeleh sesh vata kol", "Your winds blind all"],
  ["val rel kesheh", "Do not harm our flesh"],
  ["tso teal's tsol nali", "Bring to new lands"],
  ["koa's - rel's - tsecht's", "Ruin, harm, peace"],
  ["koa's - rel's - tsacht", "Ruin, harm, peace"],
  ["neali yeketeh", "We are your children"],
  ["tso neali tsacht", "Give us peace"]
]);

let activeLexicon = confirmedLexicon;
let lexiconByAncient = new Map();
let englishToAncient = new Map();
let activeSource = null;
let appReady = false;
let lexiconSortState = { field: "ancient", direction: "asc" };
let selectedLexiconHeadword = null;
let rulesNotesMarkdown = "";
let lexiconSourcePayload = { confirmed: [], inferred: [] };
let rulesEditorDirty = false;

function supportsFileEditing() {
  return window.location.protocol !== "file:";
}

englishInput.addEventListener("input", () => {
  if (!appReady) {
    return;
  }

  if (activeSource === "ancient") {
    return;
  }

  activeSource = "english";
  ancientInput.value = translateEnglishToAncient(englishInput.value);
  renderAnalysis(analyzeAncientText(ancientInput.value));
  activeSource = null;
});

ancientInput.addEventListener("input", () => {
  if (!appReady) {
    return;
  }

  if (activeSource === "english") {
    return;
  }

  activeSource = "ancient";
  const analysis = analyzeAncientText(ancientInput.value);
  englishInput.value = getSelectedOutput(analysis);
  renderAnalysis(analysis);
  activeSource = null;
});

fillEnglishButton.addEventListener("click", () => {
  if (!appReady) {
    return;
  }

  englishInput.value = "bring ruin, bring ruin\nour lives are yours";
  englishInput.dispatchEvent(new Event("input"));
});

fillAncientButton.addEventListener("click", () => {
  if (!appReady) {
    return;
  }

  ancientInput.value = "Tso'koa, Tso'koa\nNeali micht tealeh\nVal rel kesheh";
  ancientInput.dispatchEvent(new Event("input"));
});

includeInferredToggle.addEventListener("change", () => {
  if (!appReady) {
    return;
  }

  refreshLexiconState();

  if (activeSource === "ancient" || ancientInput.value.trim()) {
    ancientInput.dispatchEvent(new Event("input"));
    return;
  }

  englishInput.dispatchEvent(new Event("input"));
});

outputModeSelect.addEventListener("change", () => {
  if (!appReady) {
    return;
  }

  if (ancientInput.value.trim()) {
    ancientInput.dispatchEvent(new Event("input"));
  }
});

lexiconSearchInput?.addEventListener("input", () => {
  if (appReady) {
    renderLexiconTable();
  }
});

lexiconStatusFilter?.addEventListener("change", () => {
  if (appReady) {
    renderLexiconTable();
  }
});

lexiconRegisterFilter?.addEventListener("change", () => {
  if (appReady) {
    renderLexiconTable();
  }
});

lexiconCategoryFilter?.addEventListener("change", () => {
  if (appReady) {
    renderLexiconTable();
  }
});

for (const button of lexiconSortButtons) {
  button.addEventListener("click", () => {
    const field = button.dataset.lexiconSort;
    if (!field) {
      return;
    }

    if (lexiconSortState.field === field) {
      lexiconSortState.direction = lexiconSortState.direction === "asc" ? "desc" : "asc";
    } else {
      lexiconSortState = { field, direction: "asc" };
    }

    syncLexiconSortButtons();
    if (appReady) {
      renderLexiconTable();
    }
  });
}

for (const button of tabButtons) {
  button.addEventListener("click", () => {
    const target = button.dataset.tabTarget;
    setActiveTab(target);
  });
}

lexiconGraphCloseButton?.addEventListener("click", closeLexiconGraphModal);
lexiconGraphBackdrop?.addEventListener("click", closeLexiconGraphModal);
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && !lexiconGraphModal?.hidden) {
    closeLexiconGraphModal();
    return;
  }

  if (event.key === "Escape" && !lexiconEntryModal?.hidden) {
    closeLexiconEntryModal();
  }
});

downloadLexiconMarkdownButton?.addEventListener("click", () => {
  if (!appReady) {
    return;
  }

  downloadLexiconMarkdown();
});

syncLexiconSortButtons();

lexiconFileInput?.addEventListener("change", async (event) => {
  const [file] = event.target.files ?? [];
  if (!file) {
    return;
  }

  try {
    setLexiconStatus(`Loading ${file.name}...`);
    const text = await file.text();
    const payload = JSON.parse(text);
    persistImportedLexicon(payload);
    applyLexiconPayload(payload);
    setLexiconStatus(`Using imported lexicon: ${file.name}`);
    translatorNote.textContent = "Imported JSON lexicon is active and saved locally for reuse in this browser.";
    appReady = true;
    rerenderActiveSource();
  } catch (error) {
    console.error(error);
    setLexiconStatus(`Could not read ${file.name}. Expected JSON with confirmed/inferred arrays.`, true);
  } finally {
    event.target.value = "";
  }
});

lexiconNewEntryButton?.addEventListener("click", () => {
  openLexiconEntryModal();
});

lexiconEntryCancelButton?.addEventListener("click", closeLexiconEntryModal);
lexiconEntryBackdrop?.addEventListener("click", closeLexiconEntryModal);
lexiconEntryDeleteButton?.addEventListener("click", async () => {
  if (!supportsFileEditing()) {
    setLexiconEditorStatus("File editing requires the local server launcher.", true);
    return;
  }

  const ancient = lexiconEntryOriginalInput?.value?.trim();
  const group = lexiconEntryOriginalGroupInput?.value?.trim();
  if (!ancient || !group) {
    closeLexiconEntryModal();
    return;
  }

  await deleteLexiconEntry(ancient, group);
});

lexiconEntryForm?.addEventListener("submit", async (event) => {
  event.preventDefault();
  await saveLexiconEntryFromForm();
});

rulesEditButton?.addEventListener("click", () => {
  if (!rulesEditor) {
    return;
  }

  rulesEditor.value = rulesNotesMarkdown;
  rulesEditor.hidden = false;
  rulesContent.hidden = true;
  rulesEditButton.hidden = true;
  rulesSaveButton.hidden = false;
  rulesCancelButton.hidden = false;
  rulesEditorStatus.textContent = supportsFileEditing()
    ? "Editing rules-notes.md directly. Save writes back to the file."
    : "File editing requires the local server launcher.";
  rulesEditorDirty = false;
});

rulesCancelButton?.addEventListener("click", closeRulesEditor);
rulesSaveButton?.addEventListener("click", async () => {
  await saveRulesNotesMarkdown();
});
rulesEditor?.addEventListener("input", () => {
  rulesEditorDirty = true;
});

initializeApp();

function buildEnglishToAncientMap(entries) {
  const map = new Map();

  for (const entry of entries) {
    for (const meaning of entry.meanings) {
      const normalized = normalizeEnglishKey(meaning);
      if (!normalized) {
        continue;
      }

      setIfMissing(map, normalized, entry.ancient);

      if (normalized.startsWith("to ")) {
        setIfMissing(map, normalized.slice(3), entry.ancient);
      }
    }
  }

  const aliases = {
    bones: "keshoc",
    blood: "keshir",
    voice: "keshti",
    memories: "lietacht",
    stars: "tsen",
    moons: "tsin",
    suns: "tsar",
    bodies: "kesh",
    flesh: "kesh",
    minds: "vacht",
    souls: "vacht",
    spirits: "linvacht",
    guests: "nuhkesh",
    enemies: "cheechtkesh",
    strangers: "valkesh",
    children: "yeket",
    child: "yeket",
    land: "tsol",
    earth: "tsol",
    peace: "tsacht",
    ruin: "koa",
    "bring ruin": "tso'koa",
    our: "neali",
    yours: "tealeh",
    your: "teal",
    us: "neali",
    act: "ta",
    acts: "ta",
    move: "var",
    moves: "var",
    moving: "var",
    rise: "vark",
    rises: "vark",
    fall: "vorn",
    falls: "vorn",
    turn: "tor",
    turns: "tor",
    open: "chi",
    close: "chol",
    strike: "vek",
    strikes: "vek",
    wound: "vekmal",
    wounds: "vekmal",
    kill: "veklin",
    kills: "veklin",
    storm: "rekh",
    sandstorm: "secvar",
    light: "tsarhesh",
    leader: "rekmah",
    chief: "rekmahsi",
    fear: "nuhlcheecht",
    love: "nuhlloo",
    grief: "nuhlsec",
    hope: "nuhltar",
    intuition: "ruval",
    appeared: "lan",
    appears: "lan",
    appearing: "lan",
    vanished: "lin",
    vanishes: "lin",
    remembers: "rutacht",
    remembered: "rutacht",
    knows: "ru",
    seeing: "tcha",
    saw: "tcha",
    feels: "nuhl",
    heard: "kecht",
    hears: "kecht",
    slept: "soo",
    sleeps: "soo",
    sleeping: "soo",
    gave: "tsach",
    gives: "tsach",
    took: "tsich",
    takes: "tsich",
    made: "mel",
    makes: "mel",
    broke: "mal",
    breaks: "mal",
    became: "nocht",
    keeps: "tsocht",
    released: "tsecht",
    remains: "licht",
    begins: "socht",
    continues: "sacht",
    ends: "tchich"
  };

  for (const [english, ancient] of Object.entries(aliases)) {
    setIfMissing(map, english, ancient);
  }

  return map;
}

function translateEnglishToAncient(text) {
  const lines = splitLines(text);
  const translated = lines.map((line) => {
    if (!line.text.trim()) {
      return line.text;
    }

    const override = findPoeticOverrideByEnglish(line.text);
    if (override) {
      return override;
    }

    const tokens = tokenize(line.text);
    const output = [];
    let index = 0;

    while (index < tokens.length) {
      const token = tokens[index];

      if (!isWordToken(token)) {
        output.push(token);
        index += 1;
        continue;
      }

      const match = findLongestEnglishMatch(tokens, index);
      if (match) {
        output.push(match.ancient);
        index += match.length;
        continue;
      }

      if (ENGLISH_FILLERS.has(token.toLowerCase())) {
        index += 1;
        continue;
      }

      output.push(`[${token.toLowerCase()}]`);
      index += 1;
    }

    return joinTokens(output);
  });

  return rejoinLines(translated, lines);
}

function findLongestEnglishMatch(tokens, startIndex) {
  let bestMatch = null;
  let phrase = "";
  let length = 0;

  for (let cursor = startIndex; cursor < tokens.length; cursor += 1) {
    const token = tokens[cursor];

    if (/^(?:\r\n|\r|\n)$/.test(token)) {
      break;
    }

    if (/^[ \t]+$/.test(token)) {
      continue;
    }

    if (!isWordToken(token)) {
      break;
    }

    phrase = phrase ? `${phrase} ${normalizeEnglishKey(token)}` : normalizeEnglishKey(token);
    length = cursor - startIndex + 1;
    const ancient = englishToAncient.get(phrase);

    if (ancient) {
      bestMatch = { ancient, length };
    }
  }

  return bestMatch;
}

function analyzeAncientText(text) {
  const lines = splitLines(text);
  const lineAnalyses = lines.map((line) => analyzeAncientLine(line.text));
  const analyses = lineAnalyses.flatMap((line) => line.tokens);

  return {
    lines: lineAnalyses,
    analyses,
    naturalGloss: rejoinLines(
      lineAnalyses.map((line) => line.morphemeGloss),
      lines
    ),
    literalTranslation: rejoinLines(
      lineAnalyses.map((line) => line.literal),
      lines
    ),
    idiomaticTranslation: rejoinLines(
      lineAnalyses.map((line) => line.idiomatic),
      lines
    ),
    knownCount: analyses.filter((entry) => !entry.isUnknown).length,
    totalCount: analyses.length,
    inferredCount: analyses.filter((entry) => entry.status === "inferred").length,
    rescuedCount: analyses.filter((entry) => entry.path.some((step) => ["normalized", "fuzzy"].includes(step))).length
  };
}

function analyzeAncientLine(lineText) {
  const tokens = tokenize(lineText);
  const wordAnalyses = [];
  const glossTokens = [];
  const normalizedTokens = [];

  for (const token of tokens) {
    if (!isWordToken(token)) {
      glossTokens.push(token);
      continue;
    }

    const analysis = analyzeAncientToken(token);
    wordAnalyses.push(analysis);
    glossTokens.push(analysis.morphemeGloss);
    normalizedTokens.push(analysis.components.length ? analysis.components : [analysis.headword]);
  }

  return {
    text: lineText,
    tokens: wordAnalyses,
    normalizedTokens,
    morphemeGloss: joinTokens(glossTokens),
    literal: buildLiteralLine(wordAnalyses),
    idiomatic: deriveIdiomaticLine(lineText, wordAnalyses)
  };
}

function analyzeAncientToken(token) {
  const normalized = normalizeAncientKey(token);
  const path = [];

  if (LEXICAL_PRIORITY.has(normalized)) {
    const priorityEntry = lookupEntry(normalized);
    if (priorityEntry) {
      return createAnalysisFromEntry(token, priorityEntry, { path: ["direct", "lexical-priority"] });
    }
  }

  const direct = lookupEntry(normalized);
  if (direct) {
    return createAnalysisFromEntry(token, direct, { path: ["direct"] });
  }

  const normalizedRecipe = resolveNormalization(normalized);
  if (normalizedRecipe) {
    path.push("normalized");
    const normalizedAnalysis = analyzeRecipe(token, normalizedRecipe, path);
    if (normalizedAnalysis) {
      return normalizedAnalysis;
    }
  }

  const split = splitAffixes(normalized);
  if (split) {
    const splitAnalysis = analyzeRecipe(token, { type: "parts", value: split }, [...path, "suffix"]);
    if (splitAnalysis) {
      return splitAnalysis;
    }
  }

  const compound = recoverCompound(normalized);
  if (compound) {
    const compoundAnalysis = analyzeRecipe(token, { type: "parts", value: compound }, [...path, "compound"]);
    if (compoundAnalysis) {
      return compoundAnalysis;
    }
  }

  const fuzzy = findFuzzyMatch(normalized);
  if (fuzzy) {
    const fuzzyEntry = lookupEntry(fuzzy.candidate);
    if (fuzzyEntry) {
      return createAnalysisFromEntry(token, fuzzyEntry, {
        path: [...path, "fuzzy"],
        notes: [`Recovered by fuzzy match to ${fuzzyEntry.ancient}.`]
      });
    }
  }

  return {
    token,
    headword: token,
    meanings: [`[${token}]`],
    primaryGloss: `[${token}]`,
    morphemeGloss: `[${token}]`,
    components: [],
    etymology: [],
    notes: ["No direct, normalized, affixed, compound, or fuzzy recovery succeeded."],
    status: "unknown",
    register: "unknown",
    pronunciation: inferPronunciation(token),
    lexicalized: false,
    path: path.length ? path : ["unknown"],
    isUnknown: true
  };
}

function createAnalysisFromEntry(token, entry, options = {}) {
  const componentPath = entry.components?.length ? entry.components : [normalizeAncientKey(entry.ancient)];
  return {
    token,
    headword: entry.ancient,
    meanings: entry.meanings,
    primaryGloss: entry.meanings[0],
    morphemeGloss: entry.lexicalized ? entry.meanings[0] : buildMorphemeGloss(entry.components ?? [], entry.meanings[0]),
    literalGloss: buildLiteralGloss(entry, "literal"),
    narrativeGloss: buildLiteralGloss(entry, "narrative"),
    resolvedGloss: lookupPhraseRendering(componentPath) ?? collapseLexicalCompound(componentPath) ?? entry.meanings[0],
    components: entry.components ?? [],
    etymology: entry.etymology ?? [],
    notes: buildEntryNotes(entry, options.notes),
    status: entry.status ?? "confirmed",
    register: entry.register ?? "ancient",
    pronunciation: entry.pronunciation ?? inferPronunciation(entry.ancient),
    lexicalized: Boolean(entry.lexicalized),
    path: options.path ?? ["direct"],
    isUnknown: false
  };
}

function analyzeRecipe(token, recipe, path) {
  if (recipe.type === "headword") {
    const entry = lookupEntry(recipe.value);
    if (!entry) {
      return null;
    }

    return createAnalysisFromEntry(token, entry, {
      path,
      notes: [`Normalized from ${token} to ${entry.ancient}.`]
    });
  }

  if (recipe.type !== "parts") {
    return null;
  }

  const analyses = recipe.value.map((part) => {
    const entry = lookupEntry(part);
    return entry ? createAnalysisFromEntry(part, entry, { path: ["direct"] }) : null;
  });

  if (analyses.some((entry) => !entry)) {
    return null;
  }

  const parts = analyses.filter(Boolean);
  const contextual = lookupContextualRendering(recipe.value);
  const lexicalCollapse = collapseLexicalCompound(recipe.value);
  const meanings = [lexicalCollapse ?? contextual ?? parts.map((entry) => entry.primaryGloss).join(" + ")];
  const notes = [];

  if (path.includes("normalized")) {
    notes.push(`Normalized ${token} before parsing.`);
  }

  if (path.includes("suffix")) {
    notes.push(`Recovered by productive suffix split: ${recipe.value.join(" + ")}.`);
  }

  if (path.includes("compound")) {
    notes.push(`Recovered as a compound: ${recipe.value.join(" + ")}.`);
  }

  return {
    token,
    headword: token,
    meanings,
    primaryGloss: meanings[0],
    morphemeGloss: parts.map((entry) => entry.primaryGloss).join(" + "),
    literalGloss: lexicalCollapse ?? parts.map((entry) => entry.literalGloss ?? entry.primaryGloss).join(" + "),
    narrativeGloss: lexicalCollapse ?? parts.map((entry) => entry.narrativeGloss ?? entry.literalGloss ?? entry.primaryGloss).join(" + "),
    resolvedGloss: lookupPhraseRendering(recipe.value) ?? lexicalCollapse ?? meanings[0],
    components: recipe.value,
    etymology: [],
    notes,
    status: path.includes("compound") || path.includes("normalized") ? "inferred" : "segmented",
    register: "ancient",
    pronunciation: inferPronunciation(token),
    lexicalized: false,
    path,
    isUnknown: false
  };
}

function buildEntryNotes(entry, extraNotes = []) {
  const notes = [];

  if (entry.lexicalized) {
    notes.push("Lexicalized form: prefer the stored meaning before literal decomposition.");
  }

  if (entry.components?.length) {
    notes.push(`Components: ${entry.components.join(" + ")}.`);
  }

  if (entry.etymology?.length) {
    notes.push(`Etymology: ${entry.etymology.join(" + ")}.`);
  }

  return [...notes, ...(entry.notes ?? []), ...extraNotes];
}

function buildLiteralGloss(entry, mode) {
  const headword = normalizeAncientKey(entry.ancient);
  const render = NARRATIVE_RENDERINGS[headword];
  if (render) {
    return render[mode] ?? entry.meanings[0];
  }

  if (mode === "narrative" && entry.allowNominalReading) {
    return entry.meanings[1] ?? entry.meanings[0];
  }

  return entry.meanings[0];
}

function buildMorphemeGloss(components, fallback) {
  if (!components.length) {
    return fallback;
  }

  return components
    .map((part) => lookupEntry(part)?.meanings?.[0] ?? AFFIX_MEANINGS[part]?.[0] ?? part)
    .join(" + ");
}

function resolveNormalization(token) {
  const mapped = NORMALIZATION_MAP[token];
  if (!mapped) {
    return null;
  }

  if (mapped.includes("+")) {
    return { type: "parts", value: mapped.split("+").map((part) => normalizeAncientKey(part)) };
  }

  return { type: "headword", value: normalizeAncientKey(mapped) };
}

function splitAffixes(token) {
  const longestLexicalStem = findLongestLexicalStem(token);
  if (longestLexicalStem) {
    return longestLexicalStem;
  }

  for (const suffix of PRODUCTIVE_SUFFIXES) {
    if (!token.endsWith(suffix) || token === suffix) {
      continue;
    }

    const stem = token.slice(0, -suffix.length);
    if (lookupEntry(stem)) {
      return [stem, suffix];
    }

    const normalizedStem = resolveNormalization(stem);
    if (normalizedStem?.type === "headword" && lookupEntry(normalizedStem.value)) {
      return [normalizedStem.value, suffix];
    }
  }

  return null;
}

function findLongestLexicalStem(token) {
  let best = null;

  for (const suffix of PRODUCTIVE_SUFFIXES) {
    if (!token.endsWith(suffix) || token === suffix) {
      continue;
    }

    const stem = token.slice(0, -suffix.length);
    const entry = lookupEntry(stem);
    if (entry && (!best || stem.length > best[0].length)) {
      best = [stem, suffix];
    }
  }

  return best;
}

function recoverCompound(token) {
  const collapsed = token.replace(/'/g, "");
  if (collapsed !== token) {
    const segmentedCollapsed = segmentCompound(collapsed);
    if (segmentedCollapsed) {
      return segmentedCollapsed;
    }
  }

  return segmentCompound(token);
}

function segmentCompound(token) {
  if (LEXICAL_PRIORITY.has(token) && lookupEntry(token)) {
    return [token];
  }

  if (lookupEntry(token)) {
    return [token];
  }

  for (let index = 1; index < token.length; index += 1) {
    const left = token.slice(0, index);
    if (!lookupEntry(left)) {
      continue;
    }

    const right = token.slice(index);
    const remainder = segmentCompound(right);
    if (remainder) {
      return [left, ...remainder];
    }
  }

  return null;
}

function findFuzzyMatch(token) {
  const candidates = [];

  for (const key of lexiconByAncient.keys()) {
    const distance = levenshtein(token, key);
    const confidence = scoreFuzzyConfidence(token, key, distance);
    if (distance <= 2) {
      candidates.push({ candidate: key, distance, confidence });
    }
  }

  candidates.sort((left, right) => left.distance - right.distance || left.candidate.length - right.candidate.length);

  if (!candidates.length) {
    return null;
  }

  const [best, second] = candidates;
  if (best.confidence >= 0.9 && best.distance <= 1) {
    return best;
  }

  if (best.confidence >= 0.9 && best.distance === 2 && (!second || second.distance > best.distance)) {
    return best;
  }

  return null;
}

function deriveIdiomaticLine(lineText, analyses) {
  const override = POETIC_OVERRIDES.get(normalizeOverrideKey(lineText));
  if (override) {
    return override;
  }

  if (!analyses.length) {
    return lineText;
  }

  const tokens = analyses.flatMap((entry) => entry.components.length ? entry.components : [entry.headword.toLowerCase()]);
  const contextual = lookupContextualRendering(tokens);
  if (contextual) {
    return contextual;
  }

  if (tokens[0] === "val" && analyses[1]) {
    return `Do not ${analyses[1].meanings[0]} ${analyses.slice(2).map((entry) => entry.meanings[0]).join(" ")}`.trim();
  }

  const templated = renderNarrativeClause(analyses);
  if (templated) {
    return templated;
  }

  return smoothClause(analyses);
}

function renderAnalysis(analysis) {
  glossSummary.textContent = analysis.totalCount
    ? `Glossed ${analysis.knownCount} of ${analysis.totalCount} word tokens${analysis.inferredCount ? `, including ${analysis.inferredCount} inferred reading${analysis.inferredCount > 1 ? "s" : ""}` : ""}${analysis.rescuedCount ? ` and ${analysis.rescuedCount} normalized or fuzzy recover${analysis.rescuedCount > 1 ? "ies" : "y"}` : ""}.`
    : "Type Ancient Tongue to see structured glossing.";

  translatorNote.textContent = analysis.totalCount
    ? includeInferredToggle.checked
      ? "Exploratory mode is active: confirmed entries, inferred readings, normalization, and fuzzy rescue are all in play."
      : "Ancient Tongue output is parsed in layers: direct lookup, normalization, affixes, compounds, then cautious rescue."
    : "The app prefers interpretation over overconfident sentence translation.";

  morphemeOutput.textContent = analysis.lines.length
    ? analysis.lines.map((line) => `${line.text}\nnormalized: ${line.normalizedTokens.map((parts) => `[${parts.join(", ")}]`).join(" ")}\ngloss: ${line.morphemeGloss}`).join("\n\n")
    : "Type Ancient Tongue to see line glosses.";

  literalOutput.textContent = analysis.lines.length
    ? analysis.lines.map((line) => `${line.text}\n${line.literal}`).join("\n\n")
    : "Type Ancient Tongue to see resolved lexical gloss.";

  idiomaticOutput.textContent = analysis.lines.length
    ? analysis.lines.map((line) => `${line.text}\n${line.idiomatic}`).join("\n\n")
    : "Type Ancient Tongue to see idiomatic line translations.";

  analysisList.innerHTML = "";

  for (const item of analysis.analyses) {
    const card = document.createElement("article");
    card.className = `analysis-card${item.isUnknown ? " is-unknown" : ""}`;

    const header = document.createElement("div");
    header.className = "analysis-card-header";

    const title = document.createElement("h3");
    title.className = "analysis-headword";
    title.textContent = item.token;

    const pill = document.createElement("span");
    pill.className = "status-pill";
    pill.textContent = item.status;

    header.append(title, pill);
    card.append(header);

    card.append(createLabeledParagraph("Headword", item.headword));
    card.append(createLabeledParagraph("Meanings", item.meanings.join(", ")));
    card.append(createLabeledParagraph("Morpheme Gloss", item.morphemeGloss));
    card.append(createLabeledParagraph("Resolved", item.resolvedGloss ?? item.literalGloss ?? item.primaryGloss));
    card.append(createLabeledParagraph("Parse Path", item.path.join(" -> ")));

    if (item.components.length) {
      card.append(createLabeledParagraph("Components", item.components.join(" + ")));
    }

    if (item.etymology.length) {
      card.append(createLabeledParagraph("Etymology", item.etymology.join(" + ")));
    }

    if (item.register && item.register !== "unknown") {
      card.append(createLabeledParagraph("Register", item.register));
    }

    if (item.pronunciation) {
      card.append(createLabeledParagraph("Pronunciation", item.pronunciation));
    }

    if (item.notes.length) {
      card.append(createLabeledParagraph("Notes", item.notes.join(" ")));
    }

    analysisList.append(card);
  }
}

function createLabeledParagraph(label, value) {
  const paragraph = document.createElement("p");
  const strong = document.createElement("span");
  strong.className = "analysis-label";
  strong.textContent = `${label}: `;
  paragraph.append(strong, document.createTextNode(value));
  return paragraph;
}

function tokenize(text) {
  return text.match(/[A-Za-z']+|\r\n|\r|\n|[ \t]+|[^\sA-Za-z']/g) ?? [];
}

function isWordToken(token) {
  return /[A-Za-z']/.test(token);
}

function normalizeEnglishKey(text) {
  return text.toLowerCase().trim().replace(/\s+/g, " ");
}

function normalizeAncientKey(text) {
  return text
    .toLowerCase()
    .trim()
    .replace(/[’`]/g, "'")
    .replace(/[–—]/g, "-");
}

function normalizeOverrideKey(text) {
  return normalizeAncientKey(text).replace(/\s+/g, " ");
}

async function initializeApp() {
  try {
    if (window.location.protocol === "file:") {
      setLexiconStatus("Local file mode detected. Import JSON or use the local server launcher.");
    } else {
      setLexiconStatus("Loading lexicon.json...");
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

async function loadRulesNotesMarkdown() {
  const response = await fetch("./rules-notes.md", { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`Rules file failed to load with HTTP ${response.status}.`);
  }

  return response.text();
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
    if (!response.ok) {
      const fallback = await fetch("./lexicon.json", { cache: "no-store" });
      if (!fallback.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      return fallback.json();
    }

    return response.json();
  } catch (error) {
    const stored = readPersistedLexicon();
    if (stored) {
      return stored;
    }

    if (Array.isArray(window.ANCIENT_TONGUE_LEXICON)) {
      return {
        confirmed: window.ANCIENT_TONGUE_LEXICON,
        inferred: Array.isArray(window.ANCIENT_TONGUE_INFERRED_LEXICON)
          ? window.ANCIENT_TONGUE_INFERRED_LEXICON
          : []
      };
    }

    throw error;
  }
}

async function loadRulesNotesMarkdown() {
  if (window.location.protocol === "file:") {
    return "";
  }

  const response = await fetch("./api/rules-notes", { cache: "no-store" });
  if (response.ok) {
    return response.text();
  }

  const fallback = await fetch("./rules-notes.md", { cache: "no-store" });
  if (!fallback.ok) {
    throw new Error(`HTTP ${response.status}`);
  }

  return fallback.text();
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

  return "Using lexicon.json with local file save support.";
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

function renderLexiconTable() {
  if (!lexiconTableBody || !lexiconTableSummary) {
    return;
  }

  if (lexiconNewEntryButton) {
    lexiconNewEntryButton.disabled = !supportsFileEditing();
  }

  const search = normalizeEnglishKey(lexiconSearchInput?.value ?? "");
  const status = lexiconStatusFilter?.value ?? "all";
  const register = lexiconRegisterFilter?.value ?? "all";
  const category = lexiconCategoryFilter?.value ?? "all";
  const sort = lexiconSortState;

  const rows = activeLexicon
    .filter((entry) => matchesLexiconFilters(entry, { search, status, register, category }))
    .sort((left, right) => compareLexiconEntries(left, right, sort));

  lexiconTableBody.innerHTML = "";

  if (!rows.length) {
    const row = document.createElement("tr");
    const cell = document.createElement("td");
    cell.colSpan = 7;
    cell.textContent = "No lexicon entries match the current filters.";
    row.append(cell);
    lexiconTableBody.append(row);
  } else {
    for (const entry of rows) {
      const row = document.createElement("tr");
      row.append(
        createLexiconWordCell(entry),
        createTableCell(entry.meanings.join(", ")),
        createTableCell(entry.status ?? "confirmed"),
        createTableCell(entry.register ?? "unspecified"),
        createTableCell(getLexiconCategories(entry).join(", ")),
        createTableCell(entry.components?.join(" + ") ?? "—")
      );
      lexiconTableBody.append(row);
    }
  }

  lexiconTableSummary.textContent = `${rows.length} of ${activeLexicon.length} entries shown.`;
}

function createTableCell(value) {
  const cell = document.createElement("td");
  cell.textContent = value;
  return cell;
}

function createLexiconWordCell(entry) {
  const cell = document.createElement("td");
  const button = document.createElement("button");
  button.type = "button";
  button.className = "lexicon-word-button";
  if (normalizeAncientKey(entry.ancient) === normalizeAncientKey(selectedLexiconHeadword ?? "")) {
    button.classList.add("is-active");
  }
  button.textContent = entry.ancient;
  button.addEventListener("click", () => {
    selectedLexiconHeadword = entry.ancient;
    renderLexiconTable();
    renderLexiconGraph();
    openLexiconGraphModal();
  });
  cell.append(button);
  return cell;
}

function matchesLexiconFilters(entry, filters) {
  const haystack = normalizeEnglishKey([
    entry.ancient,
    ...(entry.meanings ?? []),
    ...(entry.notes ?? []),
    ...(entry.components ?? []),
    ...(entry.partOfSpeech ?? [])
  ].join(" "));

  if (filters.search && !haystack.includes(filters.search)) {
    return false;
  }

  if (filters.status !== "all" && (entry.status ?? "confirmed") !== filters.status) {
    return false;
  }

  if (filters.register !== "all" && (entry.register ?? "unspecified") !== filters.register) {
    return false;
  }

  if (filters.category !== "all" && !getLexiconCategories(entry).includes(filters.category)) {
    return false;
  }

  return true;
}

function compareLexiconEntries(left, right, sort) {
  const field = sort?.field ?? "ancient";
  const direction = sort?.direction ?? "asc";
  const factor = direction === "desc" ? -1 : 1;

  const valueFor = (entry) => {
    switch (field) {
      case "meaning":
        return entry.meanings?.[0] ?? "";
      case "status":
        return entry.status ?? "confirmed";
      case "register":
        return entry.register ?? "unspecified";
      case "category":
        return getLexiconCategories(entry).join(", ");
      case "components":
        return entry.components?.join(" + ") ?? "";
      case "ancient":
      default:
        return entry.ancient ?? "";
    }
  };

  return factor * valueFor(left).localeCompare(valueFor(right));
}

function syncLexiconSortButtons() {
  for (const button of lexiconSortButtons) {
    const isActive = button.dataset.lexiconSort === lexiconSortState.field;
    button.classList.toggle("is-active", isActive);
    const direction = isActive ? (lexiconSortState.direction === "asc" ? "^" : "v") : "";
    const baseLabel = button.textContent.replace(/[\^v]\s*$/, "").trim();
    button.textContent = direction ? `${baseLabel} ${direction}` : baseLabel;
  }
}

function renderLexiconGraph() {
  if (!lexiconGraphRoot || !lexiconGraphSummary) {
    return;
  }

  lexiconGraphRoot.innerHTML = "";

  if (!selectedLexiconHeadword) {
    lexiconGraphSummary.textContent = "Select a word from the lexicon table to see its descendants.";
    return;
  }

  const entry = lookupEntry(selectedLexiconHeadword);
  if (!entry) {
    lexiconGraphSummary.textContent = "The selected word is not available in the active lexicon.";
    return;
  }

  const parents = findDirectLexiconParents(entry.ancient);
  const descendants = findLexiconDescendants(entry.ancient);
  lexiconGraphSummary.textContent = `${entry.ancient} has ${parents.length} direct ascendant${parents.length === 1 ? "" : "s"} and ${descendants.length} descendant${descendants.length === 1 ? "" : "s"} in the active lexicon.`;

  const layout = document.createElement("div");
  layout.className = "graph-layout";

  const ancestorsSection = document.createElement("section");
  ancestorsSection.className = "graph-section graph-section-ancestors";
  ancestorsSection.append(createGraphSectionLabel("Ascendants"));
  if (parents.length) {
    const ancestorBranch = document.createElement("div");
    ancestorBranch.className = "graph-ancestors";
    for (const parent of parents) {
      ancestorBranch.append(createGraphAncestorNode(parent.ancient, new Set([normalizeAncientKey(entry.ancient)])));
    }
    ancestorsSection.append(ancestorBranch);
  } else {
    ancestorsSection.append(createGraphEmptyState("No recorded ascendants."));
  }

  const centerSection = document.createElement("section");
  centerSection.className = "graph-section graph-section-center";
  centerSection.append(createGraphSectionLabel("Selected Word"));
  centerSection.append(createGraphCenterNode(entry.ancient));

  const descendantsSection = document.createElement("section");
  descendantsSection.className = "graph-section graph-section-descendants";
  descendantsSection.append(createGraphSectionLabel("Descendants"));
  if (descendants.length) {
    descendantsSection.append(createGraphTreeNode(entry.ancient, new Set()));
  } else {
    descendantsSection.append(createGraphEmptyState("No recorded descendants."));
  }

  layout.append(ancestorsSection, centerSection, descendantsSection);
  lexiconGraphRoot.append(layout);
}

function openLexiconGraphModal() {
  if (!lexiconGraphModal) {
    return;
  }

  lexiconGraphModal.hidden = false;
  document.body.classList.add("modal-open");
}

function closeLexiconGraphModal() {
  if (!lexiconGraphModal) {
    return;
  }

  lexiconGraphModal.hidden = true;
  if (lexiconEntryModal?.hidden !== false) {
    document.body.classList.remove("modal-open");
  }
}

function createGraphTreeNode(headword, visited) {
  const normalizedHeadword = normalizeAncientKey(headword);
  const entry = lookupEntry(normalizedHeadword);
  const node = document.createElement("div");
  node.className = "graph-node";

  const chip = document.createElement("button");
  chip.type = "button";
  chip.className = "graph-node-chip";
  chip.textContent = entry
    ? `${entry.ancient} — ${entry.meanings?.[0] ?? ""}`
    : headword;
  chip.addEventListener("click", () => {
    selectedLexiconHeadword = entry?.ancient ?? headword;
    renderLexiconTable();
    renderLexiconGraph();
  });
  node.append(chip);

  if (visited.has(normalizedHeadword)) {
    return node;
  }

  const nextVisited = new Set(visited);
  nextVisited.add(normalizedHeadword);

  const children = findDirectLexiconChildren(normalizedHeadword);
  if (!children.length) {
    return node;
  }

  const branch = document.createElement("div");
  branch.className = "graph-children";

  for (const child of children) {
    branch.append(createGraphTreeNode(child.ancient, nextVisited));
  }

  node.append(branch);
  return node;
}

function findDirectLexiconChildren(headword) {
  const normalizedHeadword = normalizeAncientKey(headword);
  return activeLexicon
    .filter((entry) => normalizeAncientKey(entry.ancient) !== normalizedHeadword)
    .filter((entry) => getEntrySourceParts(entry).includes(normalizedHeadword))
    .sort((left, right) => left.ancient.localeCompare(right.ancient));
}

function findLexiconDescendants(headword) {
  const seen = new Set();
  const queue = findDirectLexiconChildren(headword).map((entry) => normalizeAncientKey(entry.ancient));

  while (queue.length) {
    const current = queue.shift();
    if (seen.has(current)) {
      continue;
    }

    seen.add(current);

    for (const child of findDirectLexiconChildren(current)) {
      const normalizedChild = normalizeAncientKey(child.ancient);
      if (!seen.has(normalizedChild)) {
        queue.push(normalizedChild);
      }
    }
  }

  return Array.from(seen);
}

function getEntrySourceParts(entry) {
  return Array.from(new Set([
    ...(entry.components ?? []),
    ...(entry.etymology ?? [])
  ].map((part) => normalizeAncientKey(part))));
}

function createGraphTreeNode(headword, visited) {
  const normalizedHeadword = normalizeAncientKey(headword);
  const entry = lookupEntry(normalizedHeadword);
  const node = document.createElement("div");
  node.className = "graph-node";

  const chip = document.createElement("button");
  chip.type = "button";
  chip.className = "graph-node-chip";
  if (normalizeAncientKey(headword) === normalizeAncientKey(selectedLexiconHeadword ?? "")) {
    chip.classList.add("is-active");
  }
  chip.textContent = formatGraphNodeLabel(entry, headword);
  chip.addEventListener("click", () => {
    selectedLexiconHeadword = entry?.ancient ?? headword;
    renderLexiconTable();
    renderLexiconGraph();
  });
  node.append(chip);

  if (visited.has(normalizedHeadword)) {
    return node;
  }

  const nextVisited = new Set(visited);
  nextVisited.add(normalizedHeadword);

  const children = findDirectLexiconChildren(normalizedHeadword);
  if (!children.length) {
    return node;
  }

  const branch = document.createElement("div");
  branch.className = "graph-children";

  for (const child of children) {
    branch.append(createGraphTreeNode(child.ancient, nextVisited));
  }

  node.append(branch);
  return node;
}

function createGraphAncestorNode(headword, visited) {
  const normalizedHeadword = normalizeAncientKey(headword);
  const entry = lookupEntry(normalizedHeadword);
  const node = document.createElement("div");
  node.className = "graph-node graph-node-ancestor";

  if (!visited.has(normalizedHeadword)) {
    const nextVisited = new Set(visited);
    nextVisited.add(normalizedHeadword);
    const parents = findDirectLexiconParents(normalizedHeadword);
    if (parents.length) {
      const branch = document.createElement("div");
      branch.className = "graph-ancestors";
      for (const parent of parents) {
        branch.append(createGraphAncestorNode(parent.ancient, nextVisited));
      }
      node.append(branch);
    }
  }

  const chip = document.createElement("button");
  chip.type = "button";
  chip.className = "graph-node-chip";
  chip.textContent = formatGraphNodeLabel(entry, headword);
  chip.addEventListener("click", () => {
    selectedLexiconHeadword = entry?.ancient ?? headword;
    renderLexiconTable();
    renderLexiconGraph();
  });
  node.append(chip);
  return node;
}

function createGraphCenterNode(headword) {
  const entry = lookupEntry(headword);
  const wrapper = document.createElement("div");
  wrapper.className = "graph-center";

  const chip = document.createElement("button");
  chip.type = "button";
  chip.className = "graph-node-chip is-active";
  chip.textContent = formatGraphNodeLabel(entry, headword);
  chip.addEventListener("click", () => {
    selectedLexiconHeadword = entry?.ancient ?? headword;
    renderLexiconTable();
    renderLexiconGraph();
  });
  wrapper.append(chip);
  return wrapper;
}

function createGraphSectionLabel(label) {
  const element = document.createElement("p");
  element.className = "graph-section-label";
  element.textContent = label;
  return element;
}

function createGraphEmptyState(text) {
  const element = document.createElement("p");
  element.className = "graph-empty";
  element.textContent = text;
  return element;
}

function downloadLexiconMarkdown() {
  const markdown = buildLexiconMarkdown(activeLexicon, {
    includeInferred: includeInferredToggle?.checked ?? false
  });
  const blob = new Blob([markdown], { type: "text/markdown;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  const stamp = new Date().toISOString().slice(0, 10);
  link.href = url;
  link.download = `ancient_tongue_lexicon_${stamp}.md`;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
  translatorNote.textContent = "Lexicon markdown exported from the active vocabulary.";
}

function buildLexiconMarkdown(entries, options = {}) {
  const grouped = groupEntriesForMarkdown(entries);
  const lines = [];
  const inferredCount = entries.filter((entry) => entry.status === "inferred").length;
  const confirmedCount = entries.length - inferredCount;

  lines.push("# Ancient Tongue");
  lines.push("");
  lines.push("## Overview");
  lines.push("");
  lines.push("This lexicon document was generated directly from the active Ancient Tongue vocabulary loaded in the translator.");
  lines.push("");
  lines.push(`- confirmed entries included: ${confirmedCount}`);
  lines.push(`- inferred entries included: ${inferredCount}`);
  lines.push(`- export mode included inferred entries: ${options.includeInferred ? "yes" : "no"}`);
  lines.push("");
  lines.push("---");
  lines.push("");

  for (const section of MARKDOWN_SECTION_ORDER) {
    const sectionEntries = grouped.get(section) ?? [];
    if (!sectionEntries.length) {
      continue;
    }

    lines.push(`## ${section}`);
    lines.push("");
    lines.push("| Ancient | Meaning |");
    lines.push("|---|---|");

    for (const entry of sectionEntries) {
      lines.push(`| \`${escapeMarkdownCell(entry.ancient)}\` | ${formatMeaningCell(entry)} |`);
    }

    lines.push("");
    lines.push("---");
    lines.push("");
  }

  lines.push("## Export Notes");
  lines.push("");
  lines.push("- Entries are grouped automatically from the active lexicon.");
  lines.push("- Meanings are taken directly from the current loaded vocabulary.");
  lines.push("- When inferred mode is disabled, inferred entries are omitted from the export.");
  lines.push("");

  if (rulesNotesMarkdown.trim()) {
    lines.push("---");
    lines.push("");
    lines.push(rulesNotesMarkdown.trim());
    lines.push("");
  }

  return lines.join("\n");
}

function renderRulesNotes() {
  if (!rulesContent || !rulesSummary) {
    return;
  }

  if (!rulesNotesMarkdown.trim()) {
    rulesSummary.textContent = "No rules or notes are currently loaded.";
    rulesContent.innerHTML = "<p>No rules or notes are currently loaded.</p>";
    return;
  }

  const lineCount = rulesNotesMarkdown.split(/\r?\n/).length;
  rulesSummary.textContent = `Loaded rules and notes from rules-notes.md (${lineCount} lines).`;
  rulesContent.innerHTML = renderMarkdownDocument(rulesNotesMarkdown);
}

function renderMarkdownDocument(markdown) {
  const lines = markdown.replace(/\r\n/g, "\n").split("\n");
  const html = [];
  let inList = false;
  let inBlockquote = false;
  let inCode = false;
  let codeBuffer = [];
  let paragraphBuffer = [];

  const flushParagraph = () => {
    if (!paragraphBuffer.length) {
      return;
    }
    html.push(`<p>${renderInlineMarkdown(paragraphBuffer.join(" "))}</p>`);
    paragraphBuffer = [];
  };

  const closeList = () => {
    if (inList) {
      html.push("</ul>");
      inList = false;
    }
  };

  const closeBlockquote = () => {
    if (inBlockquote) {
      html.push("</blockquote>");
      inBlockquote = false;
    }
  };

  const flushCode = () => {
    if (!inCode) {
      return;
    }
    html.push(`<pre><code>${escapeHtml(codeBuffer.join("\n"))}</code></pre>`);
    codeBuffer = [];
    inCode = false;
  };

  for (const rawLine of lines) {
    const line = rawLine.trimEnd();

    if (line.startsWith("```")) {
      flushParagraph();
      closeList();
      closeBlockquote();
      if (inCode) {
        flushCode();
      } else {
        inCode = true;
        codeBuffer = [];
      }
      continue;
    }

    if (inCode) {
      codeBuffer.push(rawLine);
      continue;
    }

    if (!line.trim()) {
      flushParagraph();
      closeList();
      closeBlockquote();
      continue;
    }

    if (line === "---") {
      flushParagraph();
      closeList();
      closeBlockquote();
      html.push("<hr>");
      continue;
    }

    const headingMatch = line.match(/^(#{2,4})\s+(.*)$/);
    if (headingMatch) {
      flushParagraph();
      closeList();
      closeBlockquote();
      const level = Math.min(headingMatch[1].length, 4);
      html.push(`<h${level}>${renderInlineMarkdown(headingMatch[2])}</h${level}>`);
      continue;
    }

    const blockquoteMatch = line.match(/^>\s?(.*)$/);
    if (blockquoteMatch) {
      flushParagraph();
      closeList();
      if (!inBlockquote) {
        html.push("<blockquote>");
        inBlockquote = true;
      }
      html.push(`<p>${renderInlineMarkdown(blockquoteMatch[1])}</p>`);
      continue;
    }

    const bulletMatch = line.match(/^-\s+(.*)$/);
    if (bulletMatch) {
      flushParagraph();
      closeBlockquote();
      if (!inList) {
        html.push("<ul>");
        inList = true;
      }
      html.push(`<li>${renderInlineMarkdown(bulletMatch[1])}</li>`);
      continue;
    }

    const numberMatch = line.match(/^\d+\.\s+(.*)$/);
    if (numberMatch) {
      flushParagraph();
      closeList();
      closeBlockquote();
      html.push(`<p>${renderInlineMarkdown(line)}</p>`);
      continue;
    }

    paragraphBuffer.push(line);
  }

  flushParagraph();
  closeList();
  closeBlockquote();
  flushCode();

  return html.join("\n");
}

function renderInlineMarkdown(text) {
  let output = escapeHtml(text);
  output = output.replace(/`([^`]+)`/g, "<code>$1</code>");
  output = output.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  output = output.replace(/\*([^*]+)\*/g, "<em>$1</em>");
  return output;
}

function escapeHtml(text) {
  return String(text ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function groupEntriesForMarkdown(entries) {
  const grouped = new Map(MARKDOWN_SECTION_ORDER.map((section) => [section, []]));

  for (const entry of [...entries].sort((left, right) => (left.ancient ?? "").localeCompare(right.ancient ?? ""))) {
    const section = classifyEntryForMarkdown(entry);
    grouped.get(section).push(entry);
  }

  return grouped;
}

function classifyEntryForMarkdown(entry) {
  const ancient = normalizeAncientKey(entry.ancient);

  for (const [section, set] of Object.entries(MARKDOWN_SECTION_SETS)) {
    if (set.has(ancient)) {
      return section;
    }
  }

  const meanings = (entry.meanings ?? []).join(" ").toLowerCase();
  const categories = getLexiconCategories(entry);

  if (entry.status === "inferred") {
    return "Inferred / Etymological Roots";
  }

  if (/\b(marker|possession|plural|toward|direction|object)\b/.test(meanings)) {
    return "Grammar Markers";
  }

  if (/\b(mother|father|kin|tribe|stranger|enemy|guest|leader|ruler|servant|elder|child|children)\b/.test(meanings)) {
    return "People and Social Structure";
  }

  if (/\b(fear|anger|love|grief|hope|courage|shame|aspiration|longing|depression)\b/.test(meanings)) {
    return "Emotion";
  }

  if (/\b(mind|soul|name|shadow|dream|song|memory|intuition|remember|forget|spirit|omen|fate|promise|oath|truth|lie|silence|understand)\b/.test(meanings)) {
    return "Mind, Knowledge, and Spirit";
  }

  if (/\b(flesh|body|blood|bone|breath|voice|sound|life|birth|growth|decay)\b/.test(meanings)) {
    return "Body and Being";
  }

  if (/\b(sun|moon|star|night|day|fire|water|stone|sand|wind|sky|mountain|forest|storm|dust|river|beast|animal)\b/.test(meanings)) {
    return "Celestial and Natural Elements";
  }

  if (/\b(past|future|present|before|after|always|never|once)\b/.test(meanings)) {
    return "Time";
  }

  if (/\b(one|two|many|few)\b/.test(meanings)) {
    return "Number and Quantity";
  }

  if (/\b(in|out|here|there|path|road|journey|step|crossing|beyond|inside|between|above|below|edge|boundary)\b/.test(meanings)) {
    return "Direction and Space";
  }

  if (/\b(fight|strike|kill|protect|defend|flee|hunt|victory|defeat)\b/.test(meanings)) {
    return "Conflict and Survival";
  }

  if (/\b(move|push|pull|lift|carry|throw|fall|rise|open|close)\b/.test(meanings)) {
    return "Motion and Force";
  }

  if (/\b(grow|shrink|transform|split|join|change|shift|ask|answer|teach|learn|own|trade|other|same)\b/.test(meanings)) {
    return "Change, Learning, and Relation";
  }

  if (/\b(good|positive|evil|negative|small|short|big|tall|light|dark|order|chaos|balance)\b/.test(meanings)) {
    return "Qualities and Abstract Oppositions";
  }

  if (ancient === "tso'koa") {
    return "Ritual and Liturgical Forms";
  }

  if (meanings.includes("to ") || categories.includes("root")) {
    return "Core Verbs";
  }

  if (/\b(see|hear|feel|know|sleep|you|self|negation|harm|all|new|ruin|peace|death|land|earth)\b/.test(meanings)) {
    return "Perception, Relation, and Core Concepts";
  }

  return "Additional Entries";
}

function formatMeaningCell(entry) {
  const meaning = escapeMarkdownCell((entry.meanings ?? []).join(", "));
  const extras = [];

  if (entry.components?.length) {
    extras.push(`components: ${entry.components.map((part) => `\`${escapeMarkdownCell(part)}\``).join(" + ")}`);
  }

  if (entry.etymology?.length) {
    extras.push(`etymology: ${entry.etymology.map((part) => `\`${escapeMarkdownCell(part)}\``).join(" + ")}`);
  }

  if (!extras.length) {
    return meaning;
  }

  return `${meaning} (${extras.join("; ")})`;
}

function escapeMarkdownCell(value) {
  return String(value ?? "").replace(/\|/g, "\\|");
}

function formatGraphNodeLabel(entry, fallbackHeadword) {
  if (!entry) {
    return fallbackHeadword;
  }

  return `${entry.ancient} - ${entry.meanings?.[0] ?? ""}`;
}

function findDirectLexiconParents(headword) {
  const normalizedHeadword = normalizeAncientKey(headword);
  const selectedEntry = lookupEntry(normalizedHeadword);
  if (!selectedEntry) {
    return [];
  }

  return activeLexicon
    .filter((entry) => normalizeAncientKey(entry.ancient) !== normalizedHeadword)
    .filter((entry) => getEntrySourceParts(selectedEntry).includes(normalizeAncientKey(entry.ancient)))
    .sort((left, right) => left.ancient.localeCompare(right.ancient));
}

function findDirectLexiconChildren(headword) {
  const normalizedHeadword = normalizeAncientKey(headword);
  return activeLexicon
    .filter((entry) => normalizeAncientKey(entry.ancient) !== normalizedHeadword)
    .filter((entry) => getEntrySourceParts(entry).includes(normalizedHeadword))
    .sort((left, right) => left.ancient.localeCompare(right.ancient));
}

function findLexiconDescendants(headword) {
  const seen = new Set();
  const queue = findDirectLexiconChildren(headword).map((entry) => normalizeAncientKey(entry.ancient));

  while (queue.length) {
    const current = queue.shift();
    if (seen.has(current)) {
      continue;
    }

    seen.add(current);

    for (const child of findDirectLexiconChildren(current)) {
      const normalizedChild = normalizeAncientKey(child.ancient);
      if (!seen.has(normalizedChild)) {
        queue.push(normalizedChild);
      }
    }
  }

  return Array.from(seen);
}

function getEntrySourceParts(entry) {
  return Array.from(new Set([
    ...(entry?.components ?? []),
    ...(entry?.etymology ?? [])
  ].map((part) => normalizeAncientKey(part))));
}

function lookupEntry(key) {
  return lexiconByAncient.get(normalizeAncientKey(key)) ?? null;
}

function inferPronunciation(term) {
  return term.includes("cht")
    ? "Contains 'cht', pronounced with a guttural fricative like German 'Bach' or 'Nacht'."
    : "";
}

function findPoeticOverrideByEnglish(text) {
  const normalized = normalizeEnglishKey(text);
  const map = {
    "bring ruin, bring ruin": "Tso'koa, Tso'koa",
    "our lives are yours": "Neali micht tealeh",
    "we give you our future": "Neali tso nach tealeh",
    "your winds blind all": "Teeleh sesh vata kol",
    "do not harm our flesh": "Val rel kesheh",
    "bring to new lands": "Tso teal's tsol nali",
    "ruin, harm, peace": "Koa's - rel's - tsecht's",
    "we are your children": "Neali yeketeh",
    "give us peace": "Tso neali tsacht"
  };

  return map[normalized] ?? null;
}

function lookupContextualRendering(parts) {
  const key = Array.isArray(parts) ? parts.join("+") : parts;
  return CONTEXTUAL_RENDERINGS[key]?.[0] ?? null;
}

function collapseLexicalCompound(parts) {
  const key = Array.isArray(parts) ? parts.join("+") : parts;
  return LEXICAL_COMPOUNDS[key] ?? null;
}

function lookupPhraseRendering(parts) {
  const key = Array.isArray(parts) ? parts.join("+") : parts;
  return PHRASE_RENDERINGS[key] ?? null;
}

function buildLiteralLine(analyses) {
  const components = analyses.flatMap((entry) => entry.components.length ? entry.components : [normalizeAncientKey(entry.headword)]);
  const phraseRendering = lookupPhraseRendering(components);
  if (phraseRendering) {
    return phraseRendering;
  }
  const lexicalCollapse = collapseLexicalCompound(components);
  if (lexicalCollapse) {
    return lexicalCollapse;
  }

  return analyses
    .map((entry) => entry.resolvedGloss ?? entry.literalGloss ?? entry.primaryGloss)
    .filter((word) => !HIDDEN_TRANSLATION_MARKERS.has(normalizeAncientKey(word)))
    .join(" ");
}

function smoothClause(analyses) {
  const words = analyses.map((entry) => entry.narrativeGloss ?? entry.literalGloss ?? entry.primaryGloss);
  const heads = analyses.map((entry) => normalizeAncientKey(entry.headword));
  const components = analyses.flatMap((entry) => entry.components.length ? entry.components : [normalizeAncientKey(entry.headword)]);
  const lexicalCollapse = collapseLexicalCompound(components);

  if (heads[0] === "sitacht" && heads[1] === "valkecht" && heads[2] === "licht") {
    return "Before, silence remained.";
  }

  if (heads[0] === "lan" && heads[1] && heads[2] === "ouk" && heads[3] === "tsal") {
    return `${capitalize(withArticle(words[1]))} appeared above the sky.`;
  }

  if (heads.length >= 4 && heads[1] === "lan" && heads[2] === "jino" && heads[3] === "tsal") {
    return `${capitalize(withArticle(words[0]))} ${words[1]} between the skies.`;
  }

  if (heads[0] === "valkesh" && heads[1] === "sal" && heads[2] === "nuhkesh" && heads[3] === "sal") {
    return "A stranger came, a guest came.";
  }

  if (heads[0] === "loo" && heads[1] === "let") {
    return "Good remained always.";
  }

  if (heads[0] === "ka" && heads[1] === "licht" && heads[2] === "sesh" && heads[3] === "sal") {
    return "Day remained, and the wind came into the sand.";
  }

  if (heads[0] === "koa" && heads[1] === "valkei") {
    return "Ruin was few.";
  }

  if (heads[0] === "tso'koa" && heads[1] === "valkei") {
    return "Ruin was few.";
  }

  if (heads[0] === "kesh'skehsi" && heads[1] === "sacht" && heads[2] === "raknacht") {
    return "Our tribe continued the journey.";
  }

  if (components.join("+") === "kesh'skehsi+ar+sacht+raknacht") {
    return "Our tribe continued the journey.";
  }

  if (heads[0] === "mah" && heads[1] === "tsach") {
    return `Mother ${words[1]} ${words.slice(2).join(" ")}`.trim() + ".";
  }

  if (heads[0] === "tah" && heads[1] === "tsocht") {
    return `Father ${words[1]} ${withArticle(words[2] ?? "")}`.trim() + ".";
  }

  if (lexicalCollapse && analyses.length === 1) {
    return `${capitalize(lexicalCollapse)}.`;
  }

  const reordered = reorderLocationPhrase(analyses, words);
  const sentence = reordered.join(" ").replace(/\s+([,.;:!?])/g, "$1").trim();
  if (!sentence) {
    return "";
  }

  return sentence.charAt(0).toUpperCase() + sentence.slice(1) + (/[.!?]$/.test(sentence) ? "" : ".");
}

function renderNarrativeClause(analyses) {
  const heads = analyses.map((entry) => normalizeAncientKey(entry.headword));
  const words = analyses.map((entry) => entry.resolvedGloss ?? entry.narrativeGloss ?? entry.literalGloss ?? entry.primaryGloss);
  const renderedWords = words.filter((word) => !HIDDEN_TRANSLATION_MARKERS.has(normalizeAncientKey(word)));

  if (heads[0] === "sitacht" && heads[1] === "valkecht" && heads[2] === "licht") {
    return "Before, silence remained.";
  }

  if (heads.length === 2 && heads[1] === "licht") {
    return `${capitalize(resolveSubject(words[0], "translation"))} remained.`;
  }

  if (heads.length === 2 && heads[1] === "lin") {
    return `${capitalize(resolveSubject(words[0], "translation"))} vanished.`;
  }

  if (heads[0] === "lan" && heads[1]) {
    return `${capitalize(resolveSubject(words[1], "translation"))} appeared${words.length > 2 ? ` ${reorderNarrativeTail(analyses, words.slice(2))}` : ""}.`;
  }

  if (heads[1] === "lan" && heads[0]) {
    return `${capitalize(resolveSubject(words[0], "translation"))} appeared${words.length > 2 ? ` ${reorderNarrativeTail(analyses, words.slice(2))}` : ""}.`;
  }

  if (heads.length >= 2 && heads[1] === "sal") {
    return `${capitalize(resolveSubject(words[0], "translation"))} came${words.length > 2 ? ` ${reorderNarrativeTail(analyses, words.slice(2))}` : ""}.`;
  }

  if (heads.length >= 3 && heads[1] === "ru") {
    return `${capitalize(resolveSubject(words[0], "translation"))} knew ${resolveObject(words.slice(2))}.`;
  }

  if (heads.length >= 3 && heads[1] === "rutacht") {
    return `${capitalize(resolveSubject(words[0], "translation"))} remembered ${resolveObject(words.slice(2))}.`;
  }

  if (heads.length >= 3 && heads[1] === "sacht") {
    return `${capitalize(resolveSubject(words[0], "translation"))} continued ${reorderContinuationObject(analyses, words.slice(2))}.`;
  }

  if (heads.length >= 3 && heads[1] === "tsach") {
    return `${capitalize(resolveSubject(words[0], "translation"))} gave ${resolveObject(words.slice(2))}.`;
  }

  if (heads.length >= 3 && heads[1] === "tsocht") {
    return `${capitalize(resolveSubject(words[0], "translation"))} kept ${resolveObject(words.slice(2))}.`;
  }

  if (heads.length >= 4 && heads[1] === "kecht" && heads[3] === "rutacht") {
    const subject = capitalize(resolveSubject(words[0], "translation"));
    const heardObject = resolveObject([words[2]]);
    const rememberedObject = resolveObject(words.slice(4));
    return `${subject} heard ${heardObject} and remembered ${rememberedObject}.`;
  }

  if (heads.length >= 4 && heads[1] === "ru" && heads[3] === "rutacht") {
    const subject = capitalize(resolveSubject(words[0], "translation"));
    const knewObject = resolveObject([words[2]]);
    const rememberedObject = resolveObject(words.slice(4));
    return `${subject} knew ${knewObject} and remembered ${rememberedObject}.`;
  }

  if (heads.length >= 4 && heads[1] === "tsach" && heads[3] === "tsocht") {
    const subject = capitalize(resolveSubject(words[0], "translation"));
    const gaveObject = resolveObject([words[2]]);
    const keptObject = resolveObject(words.slice(4));
    return `${subject} gave ${gaveObject} and kept ${keptObject}.`;
  }

  if (renderedWords.length >= 4) {
    const predicatePositions = [];
    for (let index = 0; index < heads.length; index += 1) {
      if (NARRATIVE_RENDERINGS[heads[index]]) {
        predicatePositions.push(index);
      }
    }

    if (predicatePositions.length >= 2 && predicatePositions[0] + 2 === predicatePositions[1]) {
      const subject = capitalize(resolveSubject(words[0], "translation"));
      const firstVerb = renderedWords[1];
      const firstObject = resolveObject([renderedWords[2]]);
      const secondVerb = renderedWords[3];
      const secondObject = resolveObject(renderedWords.slice(4));
      if (firstObject && secondObject) {
        return `${subject} ${firstVerb} ${firstObject} and ${secondVerb} ${secondObject}.`;
      }
    }
  }

  return null;
}

function reorderNarrativeTail(analyses, tailWords) {
  const tailHeads = analyses.slice(2).map((entry) => normalizeAncientKey(entry.headword));
  if (tailHeads.includes("jino") && tailHeads.includes("tsal") && tailHeads.includes("ji")) {
    return "between the skies";
  }

  if (tailHeads.includes("ouk") && tailHeads.includes("tsal")) {
    return "above the sky";
  }

  if (tailHeads.includes("ji") && tailHeads.includes("sec")) {
    return "into the sand";
  }

  return tailWords.join(" ");
}

function reorderContinuationObject(analyses, tailWords) {
  const tailHeads = analyses.slice(2).map((entry) => normalizeAncientKey(entry.headword));
  const tailComponents = analyses.slice(2).flatMap((entry) => entry.components.length ? entry.components : [normalizeAncientKey(entry.headword)]);

  if (tailHeads[0] === "sec") {
    if (tailComponents.join("+") === "sec+sec+raknacht+socht") {
      return "over the sand, and the sand-journey began";
    }

    return "over the sand";
  }

  return tailWords.join(" ");
}

function reorderLocationPhrase(analyses, words) {
  const heads = analyses.map((entry) => normalizeAncientKey(entry.headword));
  const components = analyses.flatMap((entry) => entry.components.length ? entry.components : [normalizeAncientKey(entry.headword)]);

  if (heads[0] === "lan" && words[1]) {
    return [resolveSubject(words[1], "translation"), "appeared", ...words.slice(2)];
  }

  if (heads.includes("jino") && heads.includes("tsal") && heads.includes("ji")) {
    const subject = words[0];
    const verb = words[1] ?? "";
    return [resolveSubject(subject, "translation"), verb, "between", "the skies"];
  }

  if (heads[0] === "sesh" && heads[1] === "sacht" && components.slice(2).join("+") === "sec+sec+raknacht+socht") {
    return ["The wind", "continued", "over", "the sand,", "and", "the sand-journey", "began"];
  }

  if (heads[0] === "ruvalnacht" && heads[1] === "lan" && heads[2] === "jino" && heads[3] === "tsal") {
    return ["An omen", "appeared", "between", "the skies"];
  }

  return words.map((word, index) => {
    if (index === 0) {
      return resolveSubject(word, "translation");
    }

    if (index > 0 && /^(sky|sand|path|journey|wind|moon|sun|omen|stranger|guest|tribe|fate)$/i.test(word)) {
      return `the ${word}`;
    }

    return word;
  });
}

function withArticle(word) {
  if (!word) {
    return word;
  }

  if (/^(our|your|we|mother|father|good|ruin)$/i.test(word)) {
    return word;
  }

  if (ARTICLE_BLOCKERS.has(word.toLowerCase())) {
    return word;
  }

  if (ARTICLE_EXCEPTIONS.has(word.toLowerCase())) {
    return `the ${word}`;
  }

  if (/^[aeiou]/i.test(word)) {
    return `an ${word}`;
  }

  return `a ${word}`;
}

function getSelectedOutput(analysis) {
  const mode = outputModeSelect.value;
  if (mode === "gloss") {
    return analysis.naturalGloss;
  }

  if (mode === "resolved") {
    return analysis.literalTranslation;
  }

  return analysis.idiomaticTranslation;
}

function capitalize(value) {
  if (!value) {
    return value;
  }

  return value.charAt(0).toUpperCase() + value.slice(1);
}

function renderClause(tokens) {
  if (!tokens.length) return "";

  const predicate = tokens.find(t => CLAUSE_TYPES[t]);

  if (!predicate) {
    return tokens.join(" ");
  }

  const type = CLAUSE_TYPES[predicate];

  const subject = tokens.find(t => t !== predicate);
  const rest = tokens.filter(t => t !== predicate && t !== subject);

  const verb = NARRATIVE_RENDERINGS[predicate]?.narrative || predicate;

  if (type === "appearance") {
    return `${renderNoun(subject)} ${verb} ${renderLocation(rest)}.`.trim();
  }

  if (type === "state") {
    return `${renderNoun(subject)} ${verb}.`;
  }

  if (type === "motion") {
    return `${renderNoun(subject)} ${verb} ${renderLocation(rest)}.`.trim();
  }

  if (type === "knowledge") {
    return `${renderNoun(subject)} ${verb} ${renderNoun(rest[0])}.`;
  }

  if (type === "action") {
    return `${renderNoun(subject)} ${verb} ${renderNoun(rest[0])}.`;
  }

  return tokens.join(" ");
}

function applySubjectCarryover(lines) {
  let lastSubject = null;

  return lines.map(line => {
    if (!line) return line;

    const words = line.split(" ");

    if (words.length < 2) return line;

    const first = words[0];

    if (CLAUSE_TYPES[first] && lastSubject) {
      return `${lastSubject} ${line}`;
    }

    lastSubject = words[0];

    return line;
  });
}

function renderNoun(noun) {
  if (!noun) return "";

  if (noun === "we") return "we";
  if (noun === "our tribe") return "our tribe";

  if (ARTICLE_EXCEPTIONS.has(noun)) {
    return `the ${noun}`;
  }

  if (noun === "omen") return "an omen";
  if (noun === "stranger") return "a stranger";
  if (noun === "guest") return "a guest";

  return noun;
}

function renderLocation(parts) {
  if (!parts || !parts.length) return "";

  if (parts.includes("ouk") && parts.includes("tsal")) {
    return "above the sky";
  }

  if (parts.includes("sec")) {
    return "over the sand";
  }

  if (parts.includes("jino")) {
    return "between the skies";
  }

  return parts.join(" ");
}

function smoothVerbs(sentence) {
  return sentence
    .replace(/heard the wind remembered/, "heard the wind and remembered")
    .replace(/gave breath father/, "gave breath, father")
    .replace(/came guest came/, "came, a guest came");
}

function resolveSubject(word, mode) {
  if (mode === "translation") {
    if (/^tribe \+ agent marker$/i.test(word)) {
      return "our tribe";
    }

    if (/^we$/i.test(word)) {
      return "we";
    }

    if (/^(sun|moon|sky|wind|sand|day|night)$/i.test(word)) {
      return `the ${word}`;
    }
  }

  return withArticle(word);
}

function resolveObject(words) {
  const joined = words
    .filter((word) => !HIDDEN_TRANSLATION_MARKERS.has(normalizeAncientKey(word)))
    .join(" ")
    .trim();
  if (/^fate$/i.test(joined)) {
    return "fate";
  }

  if (/^(journey|path|breath)$/i.test(joined)) {
    return `the ${joined}`;
  }

  return joined;
}

function splitLines(text) {
  const parts = text.split(/(\r\n|\r|\n)/);
  const lines = [];

  for (let index = 0; index < parts.length; index += 2) {
    lines.push({
      text: parts[index] ?? "",
      ending: parts[index + 1] ?? ""
    });
  }

  return lines;
}

function rejoinLines(values, lines) {
  return values.map((value, index) => `${value}${lines[index]?.ending ?? ""}`).join("");
}

function setIfMissing(map, key, value) {
  if (!map.has(key)) {
    map.set(key, value);
  }
}

function joinTokens(tokens) {
  let result = "";

  for (const token of tokens) {
    if (/^(?:\r\n|\r|\n|[ \t]+)$/.test(token)) {
      result += token;
      continue;
    }

    const isPunctuation = /^[,.;:!?)]$/.test(token);
    const opensBracket = token === "(";
    const previousEndsWithOpenQuote = /[(]$/.test(result);

    if (!result) {
      result = token;
      continue;
    }

    if (isPunctuation || previousEndsWithOpenQuote) {
      result += token;
      continue;
    }

    if (opensBracket) {
      result += ` ${token}`;
      continue;
    }

    result += ` ${token}`;
  }

  return result;
}

function levenshtein(left, right) {
  const rows = left.length + 1;
  const cols = right.length + 1;
  const matrix = Array.from({ length: rows }, () => Array(cols).fill(0));

  for (let row = 0; row < rows; row += 1) {
    matrix[row][0] = row;
  }

  for (let col = 0; col < cols; col += 1) {
    matrix[0][col] = col;
  }

  for (let row = 1; row < rows; row += 1) {
    for (let col = 1; col < cols; col += 1) {
      const cost = left[row - 1] === right[col - 1] ? 0 : 1;
      matrix[row][col] = Math.min(
        matrix[row - 1][col] + 1,
        matrix[row][col - 1] + 1,
        matrix[row - 1][col - 1] + cost
      );
    }
  }

  return matrix[left.length][right.length];
}

function scoreFuzzyConfidence(surface, target, distance) {
  const base = 1 - distance / Math.max(surface.length, target.length, 1);

  if ((target === `${surface}t` || target === `${surface}ht` || target === `${surface}cht`) && distance <= 2) {
    return 0.93;
  }

  if (surface.replace(/'/g, "") === target.replace(/'/g, "") && distance <= 2) {
    return 0.95;
  }

  if (collapseRepeatedVowels(surface) === collapseRepeatedVowels(target) && distance <= 2) {
    return 0.92;
  }

  if (distance === 1 && base >= 0.75) {
    return 0.91;
  }

  return base;
}

function collapseRepeatedVowels(value) {
  return value.replace(/([aeiou])\1+/g, "$1");
}

function finalCleanup(text) {
  return text
    .replace(/\s+/g, " ")
    .replace(/\s\./g, ".")
    .replace(/\s,/g, ",")
    .trim();
}

function createLexiconActionCell(entry) {
  const cell = document.createElement("td");
  const button = document.createElement("button");
  button.type = "button";
  button.className = "table-action-button";
  button.textContent = "Edit";
  button.disabled = !supportsFileEditing();
  button.title = supportsFileEditing()
    ? "Edit this entry"
    : "Run start-translator.bat to edit external source files.";
  button.addEventListener("click", () => openLexiconEntryModal(entry));
  cell.append(button);
  return cell;
}

function renderLexiconTable() {
  if (!lexiconTableBody || !lexiconTableSummary) {
    return;
  }

  const search = normalizeEnglishKey(lexiconSearchInput?.value ?? "");
  const status = lexiconStatusFilter?.value ?? "all";
  const register = lexiconRegisterFilter?.value ?? "all";
  const category = lexiconCategoryFilter?.value ?? "all";
  const sort = lexiconSortState;

  const rows = activeLexicon
    .filter((entry) => matchesLexiconFilters(entry, { search, status, register, category }))
    .sort((left, right) => compareLexiconEntries(left, right, sort));

  lexiconTableBody.innerHTML = "";

  if (!rows.length) {
    const row = document.createElement("tr");
    const cell = document.createElement("td");
    cell.colSpan = 7;
    cell.textContent = "No lexicon entries match the current filters.";
    row.append(cell);
    lexiconTableBody.append(row);
  } else {
    for (const entry of rows) {
      const row = document.createElement("tr");
      row.append(
        createLexiconWordCell(entry),
        createTableCell(entry.meanings.join(", ")),
        createTableCell(entry.status ?? "confirmed"),
        createTableCell(entry.register ?? "unspecified"),
        createTableCell(getLexiconCategories(entry).join(", ")),
        createTableCell(entry.components?.join(" + ") ?? "—"),
        createLexiconActionCell(entry)
      );
      lexiconTableBody.append(row);
    }
  }

  lexiconTableSummary.textContent = `${rows.length} of ${activeLexicon.length} entries shown.`;
  setLexiconEditorStatus(
    supportsFileEditing()
      ? "Edit entries directly here. Saves go back to lexicon.json."
      : "Editing source files requires the local server launcher."
  );
}

function renderRulesNotes() {
  if (!rulesContent || !rulesSummary) {
    return;
  }

  const editing = !rulesEditor?.hidden;
  if (rulesEditButton) {
    rulesEditButton.hidden = editing || !supportsFileEditing();
  }
  if (rulesSaveButton) {
    rulesSaveButton.hidden = !editing;
  }
  if (rulesCancelButton) {
    rulesCancelButton.hidden = !editing;
  }

  if (!rulesNotesMarkdown.trim()) {
    rulesSummary.textContent = "No rules or notes are currently loaded.";
    rulesContent.innerHTML = "<p>No rules or notes are currently loaded.</p>";
  } else {
    const lineCount = rulesNotesMarkdown.split(/\r?\n/).length;
    rulesSummary.textContent = `Loaded rules and notes from rules-notes.md (${lineCount} lines).`;
    rulesContent.innerHTML = renderMarkdownDocument(rulesNotesMarkdown);
  }

  if (rulesEditorStatus && !editing) {
    rulesEditorStatus.textContent = supportsFileEditing()
      ? "This tab is rendered directly from rules-notes.md and can be edited here."
      : "Run start-translator.bat to edit the external rules-notes.md file from the app.";
  }
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
    const response = await fetch("./lexicon.json", { cache: "no-store" });
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

  const fallback = await fetch("./rules-notes.md", { cache: "no-store" });
  if (!fallback.ok) {
    throw new Error(`HTTP ${fallback.status}`);
  }

  return fallback.text();
}

function setLexiconEditorStatus(message, isError = false) {
  if (!lexiconEditorStatus) {
    return;
  }

  lexiconEditorStatus.textContent = message;
  lexiconEditorStatus.dataset.state = isError ? "error" : "ready";
}

function openLexiconEntryModal(entry = null) {
  if (!lexiconEntryModal || !lexiconEntryForm) {
    return;
  }

  if (!supportsFileEditing()) {
    setLexiconEditorStatus("Run start-translator.bat to edit lexicon.json from the app.", true);
    return;
  }

  if (entry) {
    populateLexiconEntryForm(entry);
    lexiconEntryDeleteButton.hidden = false;
    lexiconEntryStatus.textContent = "Editing an existing entry from lexicon.json.";
  } else {
    lexiconEntryForm.reset();
    lexiconEntryOriginalInput.value = "";
    lexiconEntryOriginalGroupInput.value = "confirmed";
    entryGroupInput.value = "confirmed";
    entryStatusInput.value = "confirmed";
    entryRegisterInput.value = "both";
    lexiconEntryDeleteButton.hidden = true;
    lexiconEntryStatus.textContent = "Creating a new entry in lexicon.json.";
  }

  lexiconEntryModal.hidden = false;
  document.body.classList.add("modal-open");
}

function closeLexiconEntryModal() {
  if (!lexiconEntryModal) {
    return;
  }

  lexiconEntryModal.hidden = true;
  if (lexiconGraphModal?.hidden !== false) {
    document.body.classList.remove("modal-open");
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
    setLexiconEditorStatus(`Saved ${entry.ancient} to lexicon.json.`);
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
    setLexiconEditorStatus(`Deleted ${ancient} from lexicon.json.`);
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
    throw new Error(`Could not save lexicon.json (HTTP ${response.status}).`);
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
      throw new Error(`Could not save rules-notes.md (HTTP ${response.status}).`);
    }

    const savedMarkdown = await response.text();
    applyRulesNotesMarkdown(savedMarkdown);
    closeRulesEditor();
    if (rulesEditorStatus) {
      rulesEditorStatus.textContent = "Saved rules-notes.md.";
    }
  } catch (error) {
    console.error(error);
    if (rulesEditorStatus) {
      rulesEditorStatus.textContent = error.message || "Could not save rules-notes.md.";
    }
  }
}
