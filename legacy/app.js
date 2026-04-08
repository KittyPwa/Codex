const lexicon = Array.isArray(window.ANCIENT_TONGUE_LEXICON)
  ? window.ANCIENT_TONGUE_LEXICON
  : [];

const englishInput = document.querySelector("#english-input");
const ancientInput = document.querySelector("#ancient-input");
const fillEnglishButton = document.querySelector("#fill-english");
const fillAncientButton = document.querySelector("#fill-ancient");
const analysisList = document.querySelector("#analysis-list");
const glossSummary = document.querySelector("#gloss-summary");
const translatorNote = document.querySelector("#translator-note");
const includeInferredToggle = document.querySelector("#include-inferred");

if (!lexicon.length) {
  throw new Error("Ancient Tongue lexicon failed to load. Check lexicon.js.");
}

const inferredLexicon = Array.isArray(window.ANCIENT_TONGUE_INFERRED_LEXICON)
  ? window.ANCIENT_TONGUE_INFERRED_LEXICON
  : [];
const englishFillers = new Set(["the", "a", "an"]);
let activeLexicon = lexicon;
let lexiconByAncient = new Map();
let englishToAncient = new Map();

let activeSource = null;

refreshLexiconState();

englishInput.addEventListener("input", () => {
  if (activeSource === "ancient") {
    return;
  }

  activeSource = "english";
  ancientInput.value = translateEnglishToAncient(englishInput.value);
  renderAnalysis(analyzeAncientText(ancientInput.value));
  activeSource = null;
});

ancientInput.addEventListener("input", () => {
  if (activeSource === "english") {
    return;
  }

  activeSource = "ancient";
  const analysis = analyzeAncientText(ancientInput.value);
  englishInput.value = analysis.naturalGloss;
  renderAnalysis(analysis);
  activeSource = null;
});

fillEnglishButton.addEventListener("click", () => {
  englishInput.value = "the sun and the moon appear here after night";
  englishInput.dispatchEvent(new Event("input"));
});

fillAncientButton.addEventListener("click", () => {
  ancientInput.value = "keshoc-en mal ruvalnacht";
  ancientInput.dispatchEvent(new Event("input"));
});

includeInferredToggle.addEventListener("change", () => {
  refreshLexiconState();

  if (activeSource === "ancient" || ancientInput.value.trim()) {
    ancientInput.dispatchEvent(new Event("input"));
    return;
  }

  englishInput.dispatchEvent(new Event("input"));
});

englishInput.value = "the spirit remember truth";
englishInput.dispatchEvent(new Event("input"));

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

      if (normalized.startsWith("the ")) {
        setIfMissing(map, normalized.slice(4), entry.ancient);
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
    minds: "vacht",
    souls: "vacht",
    spirits: "linvacht",
    guests: "nuhkesh",
    enemies: "cheechtkesh",
    strangers: "valkesh",
    children: "yeket",
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
    child: "keshyeket",
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
  const tokens = tokenize(text);
  const translated = [];
  let index = 0;

  while (index < tokens.length) {
    const token = tokens[index];

    if (!isWordToken(token)) {
      translated.push(token);
      index += 1;
      continue;
    }

    const match = findLongestEnglishMatch(tokens, index);
    if (match) {
      translated.push(match.ancient);
      index += match.length;
      continue;
    }

    if (englishFillers.has(token.toLowerCase())) {
      index += 1;
      continue;
    }

    translated.push(`[${token.toLowerCase()}]`);
    index += 1;
  }

  return joinTokens(translated);
}

function findLongestEnglishMatch(tokens, startIndex) {
  let bestMatch = null;
  let phrase = "";

  for (let cursor = startIndex; cursor < tokens.length; cursor += 1) {
    const token = tokens[cursor];
    if (!isWordToken(token)) {
      break;
    }

    phrase = phrase ? `${phrase} ${normalizeEnglishKey(token)}` : normalizeEnglishKey(token);
    const ancient = englishToAncient.get(phrase);

    if (ancient) {
      bestMatch = {
        ancient,
        length: cursor - startIndex + 1
      };
    }
  }

  return bestMatch;
}

function analyzeAncientText(text) {
  const tokens = tokenize(text);
  const analyses = [];
  const glossTokens = [];

  for (const token of tokens) {
    if (!isWordToken(token)) {
      glossTokens.push(token);
      continue;
    }

    const analysis = analyzeAncientToken(token);
    analyses.push(analysis);
    glossTokens.push(analysis.primaryGloss);
  }

  return {
    analyses,
    naturalGloss: joinTokens(glossTokens),
    knownCount: analyses.filter((entry) => !entry.isUnknown).length,
    totalCount: analyses.length,
    inferredCount: analyses.filter((entry) => entry.status === "inferred").length
  };
}

function analyzeAncientToken(token) {
  const normalized = normalizeAncientKey(token);
  const directEntry = lexiconByAncient.get(normalized);

  if (directEntry) {
    return {
      token,
      headword: directEntry.ancient,
      meanings: directEntry.meanings,
      primaryGloss: directEntry.meanings[0],
      components: directEntry.components ?? [],
      notes: buildEntryNotes(directEntry),
      status: directEntry.status ?? "confirmed",
      register: directEntry.register ?? "ancient",
      pronunciation: directEntry.pronunciation ?? inferPronunciation(directEntry.ancient),
      isUnknown: false
    };
  }

  const markerMatch = splitMarkedToken(normalized);
  if (markerMatch) {
    const [stem, marker] = markerMatch;
    const stemEntry = lexiconByAncient.get(stem);
    const markerEntry = lexiconByAncient.get(marker);

    if (stemEntry && markerEntry) {
      return {
        token,
        headword: token,
        meanings: [`${stemEntry.meanings[0]} + ${markerEntry.meanings[0]}`],
        primaryGloss: `${stemEntry.meanings[0]}-${abbreviateMarker(marker)}`,
        components: [stemEntry.ancient, markerEntry.ancient],
        notes: [`Segmented as ${stemEntry.ancient} + ${markerEntry.ancient}.`],
        status: "segmented",
        register: "ancient",
        pronunciation: inferPronunciation(token),
        isUnknown: false
      };
    }
  }

  const segmented = segmentCompound(normalized);
  if (segmented.length > 1) {
    const componentEntries = segmented.map((part) => lexiconByAncient.get(part));
    return {
      token,
      headword: token,
      meanings: [componentEntries.map((entry) => entry.meanings[0]).join(" + ")],
      primaryGloss: componentEntries.map((entry) => entry.meanings[0]).join(" + "),
      components: segmented,
      notes: ["No direct entry found; this is a possible compound analysis."],
      status: "inferred",
      register: "ancient",
      pronunciation: inferPronunciation(token),
      isUnknown: false
    };
  }

  return {
    token,
    headword: token,
    meanings: [`[${token}]`],
    primaryGloss: `[${token}]`,
    components: [],
    notes: ["No confirmed headword or recoverable compound analysis was found."],
    status: "unknown",
    register: "unknown",
    pronunciation: inferPronunciation(token),
    isUnknown: true
  };
}

function buildEntryNotes(entry) {
  const notes = [...(entry.notes ?? [])];

  if (entry.components?.length) {
    notes.unshift(`Components: ${entry.components.join(" + ")}.`);
  }

  return notes;
}

function inferPronunciation(term) {
  return term.includes("cht")
    ? "Contains 'cht', pronounced with a guttural fricative like German 'Bach' or 'Nacht'."
    : "";
}

function splitMarkedToken(token) {
  const markers = ["en", "ar", "eh", "i"];

  for (const marker of markers) {
    if (token.length > marker.length && token.endsWith(`-${marker}`)) {
      return [token.slice(0, -marker.length - 1), marker];
    }
  }

  return null;
}

function abbreviateMarker(marker) {
  const map = {
    ar: "AGT",
    en: "OBJ",
    eh: "POSS",
    i: "PL"
  };

  return map[marker] ?? marker.toUpperCase();
}

function segmentCompound(token) {
  const results = segmentRecursively(token);
  return results ?? [];
}

function segmentRecursively(token) {
  if (lexiconByAncient.has(token)) {
    return [token];
  }

  for (let index = 1; index < token.length; index += 1) {
    const left = token.slice(0, index);
    if (!lexiconByAncient.has(left)) {
      continue;
    }

    const remainder = token.slice(index);
    const segmentedRemainder = segmentRecursively(remainder);
    if (segmentedRemainder) {
      return [left, ...segmentedRemainder];
    }
  }

  return null;
}

function renderAnalysis(analysis) {
  glossSummary.textContent = analysis.totalCount
    ? `Glossed ${analysis.knownCount} of ${analysis.totalCount} word tokens${analysis.inferredCount ? `, including ${analysis.inferredCount} inferred reading${analysis.inferredCount > 1 ? "s" : ""}` : ""}.`
    : "Type Ancient Tongue to see structured glossing.";

  translatorNote.textContent = analysis.totalCount
    ? includeInferredToggle.checked
      ? "Exploratory mode is active: confirmed entries and inferred readings are both being considered."
      : "Ancient Tongue output is presented as interpretive glossing, not a rigid one-to-one translation."
    : "The app prefers interpretation over overconfident sentence translation.";

  analysisList.innerHTML = "";

  if (!analysis.analyses.length) {
    return;
  }

  for (const item of analysis.analyses) {
    const card = document.createElement("article");
    card.className = `analysis-card${item.isUnknown ? " is-unknown" : ""}`;

    const header = document.createElement("div");
    header.className = "analysis-card-header";

    const title = document.createElement("h3");
    title.className = "analysis-headword";
    title.textContent = item.headword;

    const pill = document.createElement("span");
    pill.className = "status-pill";
    pill.textContent = item.status;

    header.append(title, pill);
    card.append(header);

    card.append(createLabeledParagraph("Meanings", item.meanings.join(", ")));

    if (item.components.length) {
      card.append(createLabeledParagraph("Components", item.components.join(" + ")));
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
  return text.toLowerCase().trim().replace(/[’`]/g, "'");
}

function refreshLexiconState() {
  activeLexicon = includeInferredToggle.checked
    ? [...lexicon, ...inferredLexicon]
    : lexicon;

  lexiconByAncient = new Map(
    activeLexicon.map((entry) => [normalizeAncientKey(entry.ancient), entry])
  );

  englishToAncient = buildEnglishToAncientMap(activeLexicon);
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
