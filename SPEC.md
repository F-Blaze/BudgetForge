# BudgetForge — Spec

## 1. Classification rubric

Each pasted line item is classified by the LLM against a fixed rubric.

### Necessity bucket

Exactly one of the following, judged **relative to the project as designed**
based on the item's stated reason — not against some hypothetical
different build approach. If the reason states the item is required for
the build's chosen method, that method is treated as fixed and necessity
is judged within it.

- **critical** — the project fails or becomes unsafe without it.
- **important** — the project works, but quality or reliability
  meaningfully suffers without it.
- **nice-to-have** — comfort, aesthetics, or marginal improvement only.
- **redundant** — duplicates another item's function in the list, or the
  stated reason doesn't justify inclusion. This includes an item being
  redundant *with itself* — two identical or near-identical items where
  one is described as a backup/spare/duplicate of the other. That's
  treated as the clearest form of redundancy, not a softer case.

### Price-tier flag

Independent of bucket — a boolean that can be `true` even on a
`critical` item. It answers a different question than necessity: *is
this specific product/spec choice overspec'd or overpriced for what the
stated reason actually requires?* A critical item can be both
necessary and overpriced at the same time (e.g. a hand-soldering
project genuinely needs a soldering iron — critical — but a $95
name-brand temperature-controlled station is overspec for the job).

### Dependency caveat

Only applies if the reason text for **that specific item** (not the
alternative being proposed, the original item) contains an explicit
signal of a locked design — words like "custom," "fabricated,"
"already ordered," "designed around," or similar. If no such signal is
present in the item's own reason text, no alternative may mention
redesign, rewiring, or firmware changes as a downside — only the
alternative's genuine functional trade-off.

This matters most for the **platform note** (see below): swapping the
core microcontroller/SBC only requires a PCB redesign if the project's
own text says a board was already fabricated/ordered around that
part's footprint. A breadboard or not-yet-fabricated project gets no
redesign caveat at all.

### Flagging formula

`flagged` is **not** a value the model outputs — it's computed
deterministically in code (see §2) from three model-provided fields:

```
flagged =
  bucket === "redundant"
  OR (bucket === "nice-to-have" AND item_cost_midpoint > list_average_cost_midpoint)
  OR price_tier_flag === true
```

where both midpoints are computed from every item's `cost_low`/`cost_high`.

## 2. Deterministic code vs. model judgment

| Computed in code (`route.ts`) | Judged by the model |
|---|---|
| `flagged` (formula above) | `bucket` |
| `original_total_low` / `original_total_high` (sum of item costs) | `price_tier_flag` |
| `optimized_total_low` / `optimized_total_high` (per-item cost minus parsed `cost_delta`, for flagged items only) | `alternatives` (name, cost_delta, pro, con) |
| `percent_saved` (midpoint-to-midpoint reduction) | `platform_note` / `platform_alternatives` |
| Real-product web-search enrichment success/failure and fallback (`fetchRealAlternative`) | `cost_low` / `cost_high` parsed from the stated cost |

The model is never asked for totals, percentages, or the `flagged`
boolean — those are pure arithmetic over model-provided per-item data,
kept in code specifically so they can't drift with model
non-determinism and so a temperature change or model swap can never
silently break the math.

## 3. Non-goals

- **No live pricing guarantee without search grounding enabled.**
  Alternatives are category-level suggestions (e.g. "generic basic
  enclosure") by default — there is no live pricing source. When
  enrichment is enabled, a second call to `groq/compound-mini` attempts
  a real, currently-priced product via actual web search (verified via
  the response's `executed_tools`, not just trusted at face value); if
  that search doesn't demonstrably happen or produces no usable result,
  the app falls back to the category-level suggestion rather than
  guessing.
- **No user accounts or database.** Nothing persists between requests;
  there's no login, no saved history, no multi-user state.
- **No chat interface.** Single input (a pasted parts list) to single
  output (a results table). No follow-up questions, no conversation.
- **Single-session, stateless tool.** Each `Analyze` click is one
  independent request; refreshing the page discards everything.

## 4. Tech stack decisions

- **Next.js App Router, one app.** The frontend (`page.tsx`) and the
  API route (`app/api/analyze/route.ts`) live in a single Next.js
  project — no separate backend service, no extra deployment target,
  one `vercel deploy` ships both. For a single-endpoint tool like this,
  splitting frontend/backend would only add infrastructure with no
  benefit.
- **Groq for inference.** Classification runs on `openai/gpt-oss-120b`
  via Groq's OpenAI-compatible endpoint, using forced tool-calling
  (`tool_choice`) against a strict JSON schema so the response is
  always structured data, never freeform text to parse.
- **Optional `groq/compound-mini` web search for alternative
  grounding.** Rather than trusting an LLM's memorized (and
  potentially stale or hallucinated) product/price knowledge,
  `compound-mini` is restricted to only the `web_search` tool
  (`compound_custom.tools.enabled_tools`) and instructed to search
  before answering. The response is checked for actual
  `executed_tools` search results before being trusted; a domain
  exclusion list keeps results off marketplaces like AliExpress/Alibaba
  in favor of retailers like Amazon, SparkFun, Adafruit, Seeed Studio,
  and Walmart. This is gated behind `ENRICHMENT_ENABLED` and only
  invoked for flagged, non-redundant items, since it costs an extra API
  call per item.
