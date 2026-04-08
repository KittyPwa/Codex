// Translator shared helpers and lookup utilities.

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

