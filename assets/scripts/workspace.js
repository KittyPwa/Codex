// Lexicon workspace, graph, rules, export, and file editing.


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

async function loadRulesNotesMarkdown() {
  const response = await fetch("./data/rules-notes.md", { cache: "no-store" });
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
      const fallback = await fetch("./data/lexicon.json", { cache: "no-store" });
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

  const fallback = await fetch("./data/rules-notes.md", { cache: "no-store" });
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
        createTableCell(entry.components?.join(" + ") ?? "â€”")
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
    ? `${entry.ancient} â€” ${entry.meanings?.[0] ?? ""}`
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
  rulesSummary.textContent = `Loaded rules and notes from data/rules-notes.md (${lineCount} lines).`;
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
        createTableCell(entry.components?.join(" + ") ?? "â€”"),
        createLexiconActionCell(entry)
      );
      lexiconTableBody.append(row);
    }
  }

  lexiconTableSummary.textContent = `${rows.length} of ${activeLexicon.length} entries shown.`;
  setLexiconEditorStatus(
    supportsFileEditing()
      ? "Edit entries directly here. Saves go back to data/lexicon.json."
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
    rulesSummary.textContent = `Loaded rules and notes from data/rules-notes.md (${lineCount} lines).`;
    rulesContent.innerHTML = renderMarkdownDocument(rulesNotesMarkdown);
  }

  if (rulesEditorStatus && !editing) {
    rulesEditorStatus.textContent = supportsFileEditing()
      ? "This tab is rendered directly from data/rules-notes.md and can be edited here."
      : "Run start-translator.bat to edit the external data/rules-notes.md file from the app.";
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
    setLexiconEditorStatus(`Saved ${entry.ancient} to data/lexicon.json.`);
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
    setLexiconEditorStatus(`Deleted ${ancient} from data/lexicon.json.`);
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
    throw new Error(`Could not save data/lexicon.json (HTTP ${response.status}).`);
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
      throw new Error(`Could not save data/rules-notes.md (HTTP ${response.status}).`);
    }

    const savedMarkdown = await response.text();
    applyRulesNotesMarkdown(savedMarkdown);
    closeRulesEditor();
    if (rulesEditorStatus) {
      rulesEditorStatus.textContent = "Saved data/rules-notes.md.";
    }
  } catch (error) {
    console.error(error);
    if (rulesEditorStatus) {
      rulesEditorStatus.textContent = error.message || "Could not save data/rules-notes.md.";
    }
  }
}
