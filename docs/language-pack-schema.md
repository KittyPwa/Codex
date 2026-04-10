# Language Pack Schema

The translator backend is moving toward a fully pack-driven model.

The machine-readable contract lives in:

- `data/language-pack.schema.json`

The backend also exposes that schema through:

- `GET /api/language-pack-schema`

## Purpose

The schema defines the expected shape of an interchangeable language pack:

- lexicon collections and entry fields
- optional lexicon field mapping through `lexicon.fieldMap`
- optional text-processing config through `text.*`
- required and recommended rules sections
- morphology segmenter types
- translation segment resolver types
- syntax-pattern placeholders and segment fields

## Current Model

The current backend expects a language pack to be composed of:

- `lexicon.json`
- `rules.json`
- `rules-notes.md`
- `language-pack.schema.json`

The schema is used by backend validation as a contract source, so required and recommended sections do not need to remain duplicated purely in PowerShell.

## Lexicon Field Mapping

The backend normalizes lexicon entries into an internal shape before translation.

That means a pack can keep using the default entry keys:

- `ancient`
- `meanings`
- `components`

or it can declare alternative paths in `rules.json`:

```json
{
  "lexicon": {
    "fieldMap": {
      "headword": "form",
      "meanings": "glosses",
      "components": "analysis.parts",
      "notes": "metadata.notes"
    }
  }
}
```

This lets different packs reuse the same backend even when their lexicon source files do not share identical field names.

## Important Note

This is a contract for the current generation of the engine, not a final universal grammar model.

The backend is already more agnostic than before, but it still assumes a pipeline shaped around:

- token analysis
- normalization
- configurable segmentation
- lexical/phrase rendering
- syntax-pattern sentence assembly

Future work should continue moving those remaining structural assumptions into the pack contract itself.

## Syntax Pattern Placeholders

Syntax patterns are no longer limited to a small fixed set of top-level segment names.

A pack can still use the legacy top-level fields:

- `subject`
- `object`
- `tail`
- `verb`

but it can also define segment descriptors under:

- `translation.syntaxPatterns[].segments`

The backend now reads placeholders directly from the template text. For example:

```json
{
  "match": { "minHeads": 2 },
  "template": "{actor} {verb} {goal}.",
  "segments": {
    "actor": { "resolver": "subject", "index": 0 },
    "verb": { "resolver": "verb", "index": 1 },
    "goal": { "resolver": "object", "start": 2 }
  }
}
```

This makes sentence assembly more pack-driven, because new packs can introduce their own template slot names without requiring backend PowerShell changes.

## Default Resolvers

The backend no longer needs to invent most common sentence resolvers internally.

Packs can define reusable fallback resolver definitions under:

- `translation.defaultResolvers`

Then, if a syntax pattern references a resolver name and does not provide a pack-specific override in:

- `translation.segmentResolvers`

the backend will resolve it from `translation.defaultResolvers`.

This is the intended home for pack-level defaults such as:

- `subject`
- `object`
- `location`
- `continuation`

`translation.segmentResolvers` can still override or extend those defaults for more specialized packs.

## Text Processing And Fallbacks

The backend can now take part of its text handling from the pack:

- `text.tokenPattern`
- `text.lineSplitPattern`
- `text.join.*`
- `translation.fallback.*`

This lets a pack influence how text is tokenized and how fallback idiomatic or literal output is assembled when no stronger syntax rule applies.

For idiomatic fallback specifically, a pack can now define:

- `translation.fallback.idiomaticSource`
- `translation.fallback.idiomaticJoiner`
- `translation.fallback.idiomaticTemplate`
- `translation.fallback.idiomaticPunctuation`

`idiomaticTemplate` supports simple placeholders such as:

- `{words}`
- `{first}`
- `{rest}`
- `{resolvedWords}`
- `{literalWords}`
- `{narrativeWords}`
- `{primaryWords}`

That gives packs control over fallback sentence shape without needing a dedicated syntax pattern for every case.

## Analysis Recovery

The backend also accepts pack-driven token recovery settings:

- `analysis.recoveryOrder`
- `analysis.compat.allowLegacyProductiveSuffixFallback`
- `analysis.directLookup`
- `analysis.normalization.missingPartPolicy`
- `analysis.segmentation.missingPartPolicy`
- `analysis.synthesis.joiner`
- `analysis.normalization.*`
- `analysis.unknown.*`

That means a pack can choose whether it prefers:

- direct lexicon lookup first
- normalization before segmentation
- segmentation before normalization

It can also decide:

- whether a partially resolved normalization or segmentation should fail closed or fall through
- how composite recovered glosses are joined
- how unknown tokens are rendered
- which note, status, register, and path values are emitted for unknown analyses

without changing backend PowerShell code.

For backward compatibility, the backend can still synthesize a suffix segmenter from `morphology.productiveSuffixes` when no explicit `morphology.segmenters` are present.

That behavior is now controlled by:

- `analysis.compat.allowLegacyProductiveSuffixFallback`

New packs should prefer explicit `morphology.segmenters`. The compatibility flag exists so older packs can keep working while the contract becomes more explicit.

## Composition Precedence

When multiple composition interpretations are possible, the pack can now choose which one wins:

- `composition.strategyMap`
- `composition.resolution.directOrder`
- `composition.resolution.normalizedOrder`
- `composition.resolution.segmentedOrder`

These orders control precedence between strategies such as:

- phrase rendering
- lexical collapse
- contextual rendering
- joined fallback text

`composition.strategyMap` also lets a pack alias its own order labels to the engine’s current built-in strategy types, so resolution orders no longer need to use the backend’s literal internal names.

## Analysis Projections

The pack can now define how token analyses project into syntax-facing arrays:

- `analysis.projections.headSource`
- `analysis.projections.componentSource`
- `analysis.projections.normalizedTokenSource`

This controls which token-analysis fields feed:

- `heads`
- `components`
- `normalizedTokens`

used by syntax patterns, overrides, and exported analysis payloads.
