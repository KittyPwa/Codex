// Translation engine and language analysis helpers.

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
    .replace(/[â€™`]/g, "'")
    .replace(/[â€“â€”]/g, "-");
}

function normalizeOverrideKey(text) {
  return normalizeAncientKey(text).replace(/\s+/g, " ");
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

    if (!result.length) {
      result = token;
      continue;
    }

    if (/[([{/"'-]$/.test(result) || /^[)\]},.!?:;"']/.test(token)) {
      result += token;
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

  const predicate = tokens.find((t) => CLAUSE_TYPES[t]);

  if (!predicate) {
    return tokens.join(" ");
  }

  const type = CLAUSE_TYPES[predicate];

  const subject = tokens.find((t) => t !== predicate);
  const rest = tokens.filter((t) => t !== predicate && t !== subject);

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

  return lines.map((line) => {
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
