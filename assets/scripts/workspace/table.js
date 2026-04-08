// Lexicon table filtering, sorting, and pagination.

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
  if (!lexiconTableBody) {
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

  const pageSize = [10, 25, 50].includes(lexiconPaginationState.pageSize)
    ? lexiconPaginationState.pageSize
    : 25;
  const totalPages = Math.max(1, Math.ceil(rows.length / pageSize));
  const currentPage = Math.min(lexiconPaginationState.page, totalPages);
  const startIndex = (currentPage - 1) * pageSize;
  const pagedRows = rows.slice(startIndex, startIndex + pageSize);

  lexiconPaginationState.page = currentPage;
  lexiconPaginationState.pageSize = pageSize;

  lexiconTableBody.innerHTML = "";

  if (!pagedRows.length) {
    const row = document.createElement("tr");
    const cell = document.createElement("td");
    cell.colSpan = 7;
    cell.textContent = "No lexicon entries match the current filters.";
    row.append(cell);
    lexiconTableBody.append(row);
  } else {
    for (const entry of pagedRows) {
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

  if (lexiconPageInfo) {
    lexiconPageInfo.textContent = rows.length
      ? `Page ${currentPage} of ${totalPages}`
      : "Page 1 of 1";
  }

  if (lexiconPagePrevButton) {
    lexiconPagePrevButton.disabled = currentPage <= 1 || !rows.length;
  }

  if (lexiconPageNextButton) {
    lexiconPageNextButton.disabled = currentPage >= totalPages || !rows.length;
  }

  if (lexiconPageSizeSelect) {
    lexiconPageSizeSelect.value = String(pageSize);
  }
}

