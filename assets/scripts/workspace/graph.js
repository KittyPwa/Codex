// Lexicon graph modal and lineage rendering.

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
