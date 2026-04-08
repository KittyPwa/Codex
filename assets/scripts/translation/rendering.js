// Translator rendering and narrative output helpers.

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
