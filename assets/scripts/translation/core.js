// Translator analysis rendering. Active translation is now served by the backend API.

function renderAnalysis(analysis) {
  const formatNormalizedParts = (parts) => `[${(Array.isArray(parts) ? parts : [parts]).join(", ")}]`;
  const languageName = getActiveLanguageName();

  glossSummary.textContent = analysis.totalCount
    ? `Glossed ${analysis.knownCount} of ${analysis.totalCount} word tokens${analysis.inferredCount ? `, including ${analysis.inferredCount} inferred reading${analysis.inferredCount > 1 ? "s" : ""}` : ""}${analysis.rescuedCount ? ` and ${analysis.rescuedCount} normalized or fuzzy recover${analysis.rescuedCount > 1 ? "ies" : "y"}` : ""}.`
    : `Type ${languageName} to see structured glossing.`;

  translatorNote.textContent = analysis.totalCount
    ? includeInferredToggle.checked
      ? "Exploratory mode is active: confirmed entries, inferred readings, normalization, and fuzzy rescue are all in play."
      : `${languageName} output is parsed in layers: direct lookup, normalization, affixes, compounds, then cautious rescue.`
    : "The app prefers interpretation over overconfident sentence translation.";

  morphemeOutput.textContent = analysis.lines.length
    ? analysis.lines.map((line) => `${line.text}\nnormalized: ${line.normalizedTokens.map((parts) => formatNormalizedParts(parts)).join(" ")}\ngloss: ${line.morphemeGloss}`).join("\n\n")
    : `Type ${languageName} to see line glosses.`;

  literalOutput.textContent = analysis.lines.length
    ? analysis.lines.map((line) => `${line.text}\n${line.literal}`).join("\n\n")
    : `Type ${languageName} to see resolved lexical gloss.`;

  idiomaticOutput.textContent = analysis.lines.length
    ? analysis.lines.map((line) => `${line.text}\n${line.idiomatic}`).join("\n\n")
    : `Type ${languageName} to see idiomatic line translations.`;

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
    card.append(createLabeledParagraph("Meanings", (Array.isArray(item.meanings) ? item.meanings : [item.meanings]).join(", ")));
    card.append(createLabeledParagraph("Morpheme Gloss", item.morphemeGloss));
    card.append(createLabeledParagraph("Resolved", item.resolvedGloss ?? item.literalGloss ?? item.primaryGloss));
    card.append(createLabeledParagraph("Parse Path", (Array.isArray(item.path) ? item.path : [item.path]).join(" -> ")));

    if ((Array.isArray(item.components) ? item.components : [item.components]).filter(Boolean).length) {
      card.append(createLabeledParagraph("Components", (Array.isArray(item.components) ? item.components : [item.components]).join(" + ")));
    }

    if ((Array.isArray(item.etymology) ? item.etymology : [item.etymology]).filter(Boolean).length) {
      card.append(createLabeledParagraph("Etymology", (Array.isArray(item.etymology) ? item.etymology : [item.etymology]).join(" + ")));
    }

    if (item.register && item.register !== "unknown") {
      card.append(createLabeledParagraph("Register", item.register));
    }

    if (item.pronunciation) {
      card.append(createLabeledParagraph("Pronunciation", item.pronunciation));
    }

    if ((Array.isArray(item.notes) ? item.notes : [item.notes]).filter(Boolean).length) {
      card.append(createLabeledParagraph("Notes", (Array.isArray(item.notes) ? item.notes : [item.notes]).join(" ")));
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

