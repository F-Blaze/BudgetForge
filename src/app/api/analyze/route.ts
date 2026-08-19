import { NextRequest, NextResponse } from "next/server";
import type { AnalyzeResponse, AnalyzedItem, Alternative } from "@/lib/types";

const MAX_INPUT_CHARS = 20000;
const GROQ_MODEL = "openai/gpt-oss-120b";
const COMPOUND_MODEL = "groq/compound-mini";
const ENRICHMENT_ENABLED = true;

const SYSTEM_PROMPT = `You audit parts lists for hobbyist hardware projects (PCBs, enclosures, sensors, fasteners, etc).

The user pastes a freeform parts list. Each line/entry roughly gives: an item name, a reason for including it, and an approximate cost (may be a range like "$5-8"). Parse it into structured items, then classify each one with this exact rubric.

NECESSITY BUCKET (pick exactly one per item):
Judge necessity relative to the project AS DESIGNED, based on the
stated reason — not whether a fundamentally different build approach
could avoid needing this category of item. If the reason states this
item is required for the build's chosen method, treat that method as
fixed and judge necessity within it.
- critical: project fails or becomes unsafe without it
- important: project works, but quality/reliability meaningfully suffers without it
- nice-to-have: comfort/aesthetics/marginal improvement only
- redundant: duplicates another item's function in the list, or the stated reason doesn't justify inclusion
An item can be redundant with itself — i.e. two identical or
near-identical items where one is described as backup/spare/duplicate
coverage of the other. This is the clearest form of redundancy, not a
softer case — treat identical-item duplication with the same weight as
overlapping-but-different products.

PRICE-TIER FLAG (independent of bucket, can be true even for critical items):
true if this specific product/spec choice is overspec'd or overpriced for what the stated reason actually requires.

DEPENDENCY CAVEAT:
Only apply the dependency/redesign caveat if the reason text for THIS
SPECIFIC ITEM (not the alternative, the original item) contains an
explicit signal of a locked design: words like "custom," "fabricated,"
"already ordered," "designed around," or similar. If no such signal is
present in the item's own reason text, do NOT mention redesign,
rewiring, or firmware changes as a con — describe only the alternative's
genuine functional trade-off instead.

CALIBRATION EXAMPLES (follow this reasoning pattern):

Example A — redundant overlap:
Two items are "OLED Display... shares I2C bus with LCD" ($6.5) and
"LCD1602 Display... shares bus with OLED" ($6). Both serve an overlapping
display/status role. Correct output: one of them (the less essential to
the project's stated purpose — here, LCD1602, since OLED is described as
the primary "robot eyes" identity element) gets bucket=redundant,
with ONE alternative object framed as "vs OLED Display"
explaining the keep-one-drop-one tradeoff. Do NOT let LCD1602's low cost
change the redundant classification — redundant items always get an
alternative regardless of cost.

Example B — critical but overspec'd:
Item: "Soldering Iron Kit... Hand-soldering all through-hole headers,
LEDs, and resistors onto the bare PCB" ($27.50). The build's stated
method requires hand-soldering — that need is fixed per rule 1 above, so
bucket=critical. However, a basic kit performs identically for a one-off
hobbyist assembly, so price_tier_flag=true. A critical
bucket does NOT exempt an item from the price-tier flag — check every
item for overspec regardless of its necessity bucket.

PLATFORM NOTE (independent of the alternatives system below):
Set platform_note=true on ONLY the single item that defines the project's core compute/control platform (e.g. the microcontroller, SBC, or main processing unit) — never on passive components, connectors, cables, or enclosures, even if they're bucket=critical. Every other item gets platform_note=false. At most one item in the whole list should have platform_note=true.
For that one item, populate platform_alternatives with 1-2 genuinely different platform families (not just cheaper versions of the same chip) — same shape as a regular alternative (name, cost_delta, pro, con). Each con is required; if the dependency caveat applies to this item, the con must explicitly say switching requires redesigning the PCB layout, not a generic downside. All other items get an empty platform_alternatives array.
This is informational, not a cost complaint — do not let platform_note or platform_alternatives influence price_tier_flag or bucket, and do not duplicate platform_alternatives into the regular alternatives array.

ALTERNATIVES (populate only for items where: bucket = redundant, OR (bucket = nice-to-have AND cost is above the list's average item cost), OR price_tier_flag = true — 1-2 alternatives each. Leave the array empty for every other item):
- name: a category-level description (e.g. "generic basic enclosure"), NEVER a specific real product or SKU — there is no live pricing source.
- cost_delta: rough estimated savings range, e.g. "-$10 to -$15".
- pro: the concrete benefit of switching.
Avoid generic phrasing like "similar functionality at a lower cost" —
state the specific, concrete benefit for this exact item (e.g. what
capability improves, or exactly why the cost drops).
- con: REQUIRED, the concrete tradeoff or risk of switching. If the dependency caveat applies to this item, con must state the compatibility risk explicitly.
Avoid generic phrasing like "potential decrease in quality" — state the
specific, concrete risk for this exact item (e.g. what precisely gets
harder, slower, or less reliable).
- If two items serve overlapping/redundant roles, do NOT list separate alternatives for each. Instead give ONE alternative object on the redundant item framed as "vs [other item]", with the pro/con being the tradeoff between keeping one vs the other.

For each item also output cost_low and cost_high as numbers parsed from the given cost (a flat cost like "$12" means cost_low=cost_high=12).

Call the return_analysis tool with the full result. Do not include any text outside the tool call.`;

const ANALYSIS_SCHEMA = {
  type: "object" as const,
  properties: {
    items: {
      type: "array",
      items: {
        type: "object",
        properties: {
          name: { type: "string" },
          reason: { type: "string" },
          cost: { type: "string", description: "cost as given in the input text" },
          cost_low: { type: "number" },
          cost_high: { type: "number" },
          bucket: {
            type: "string",
            enum: ["critical", "important", "nice-to-have", "redundant"],
          },
          price_tier_flag: { type: "boolean" },
          alternatives: {
            type: "array",
            items: {
              type: "object",
              properties: {
                name: { type: "string" },
                cost_delta: { type: "string" },
                pro: { type: "string" },
                con: { type: "string" },
              },
              required: ["name", "cost_delta", "pro", "con"],
            },
          },
          platform_note: { type: "boolean" },
          platform_alternatives: {
            type: "array",
            items: {
              type: "object",
              properties: {
                name: { type: "string" },
                cost_delta: { type: "string" },
                pro: { type: "string" },
                con: { type: "string" },
              },
              required: ["name", "cost_delta", "pro", "con"],
            },
          },
        },
        required: [
          "name",
          "reason",
          "cost",
          "cost_low",
          "cost_high",
          "bucket",
          "price_tier_flag",
          "alternatives",
          "platform_note",
          "platform_alternatives",
        ],
      },
    },
  },
  required: ["items"],
};

function parseSavingsRange(delta: string): { min: number; max: number } | null {
  const nums = delta.match(/\d+(?:\.\d+)?/g);
  if (!nums || nums.length === 0) return null;
  const values = nums.map(Number);
  return { min: Math.min(...values), max: Math.max(...values) };
}

async function fetchRealAlternative(
  item: Omit<AnalyzedItem, "flagged">,
  apiKey: string
): Promise<Alternative | null> {
  console.log("compound-mini: searching for", item.name);
  try {
    const prompt = `Search the web right now for a real, currently-available, cheaper alternative product for: ${item.name} — ${item.reason}. Do not answer from memory — actually search first. Prefer trustworthy retailers (Amazon, SparkFun, Adafruit, Seeed Studio, Walmart, and other credible electronics/general retailers). Give the actual product name, an approximate current price, and one line on the trade-off vs the original.

Respond with ONLY this exact JSON shape and nothing else, no markdown: {"name": "...", "price": "$X", "tradeoff": "..."}`;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);

    const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: COMPOUND_MODEL,
        messages: [{ role: "user", content: prompt }],
        compound_custom: { tools: { enabled_tools: ["web_search"] } },
        search_settings: {
          exclude_domains: ["aliexpress.com", "*.aliexpress.com", "alibaba.com", "*.alibaba.com"],
        },
      }),
      signal: controller.signal,
    });
    clearTimeout(timeout);
    if (!res.ok) {
      console.log("compound-mini: fell back —", `bad HTTP status ${res.status}`);
      return null;
    }

    const data = await res.json();
    const message = data.choices?.[0]?.message;
    const content: string | undefined = message?.content;
    if (!content) {
      console.log("compound-mini: fell back —", "missing content in response");
      return null;
    }

    const searched = Array.isArray(message?.executed_tools)
      ? message.executed_tools.some(
          (t: { search_results?: unknown[] }) => Array.isArray(t?.search_results) && t.search_results.length > 0
        )
      : false;
    if (!searched) {
      console.log("compound-mini: fell back —", "no web search was actually executed");
      return null;
    }

    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.log("compound-mini: fell back —", "no JSON object found in content");
      return null;
    }
    const parsed = JSON.parse(jsonMatch[0]) as {
      name?: string;
      price?: string;
      tradeoff?: string;
    };
    if (!parsed.name || !parsed.price || !parsed.tradeoff) {
      console.log("compound-mini: fell back —", "missing name/price/tradeoff field in parsed JSON");
      return null;
    }

    const priceNums = parsed.price.match(/\d+(?:\.\d+)?/g);
    if (!priceNums) {
      console.log("compound-mini: fell back —", "no number found in price string");
      return null;
    }
    const newPrice = Number(priceNums[0]);
    const originalMidpoint = (item.cost_low + item.cost_high) / 2;
    const savings = originalMidpoint - newPrice;
    if (savings <= 0) {
      console.log("compound-mini: fell back —", `non-positive savings (${savings.toFixed(2)})`);
      return null;
    }

    const real: Alternative = {
      name: parsed.name,
      cost_delta: `-$${savings.toFixed(2)}`,
      pro: `Real product currently available at ~$${newPrice.toFixed(2)} (vs ~$${originalMidpoint.toFixed(2)} originally).`,
      con: parsed.tradeoff,
    };
    console.log("compound-mini: found", real.name, real.cost_delta);
    return real;
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      console.log("compound-mini: fell back —", "timeout after 8s");
    } else {
      console.log("compound-mini: fell back —", `exception: ${err instanceof Error ? err.message : String(err)}`);
    }
    return null;
  }
}

export async function POST(req: NextRequest) {
  let text: unknown;
  try {
    ({ text } = await req.json());
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  if (typeof text !== "string" || !text.trim()) {
    return NextResponse.json({ error: "Paste a parts list first." }, { status: 400 });
  }
  if (text.length > MAX_INPUT_CHARS) {
    return NextResponse.json(
      { error: `Parts list is too long (max ${MAX_INPUT_CHARS} characters).` },
      { status: 400 }
    );
  }

  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "Server is missing GROQ_API_KEY." },
      { status: 500 }
    );
  }

  try {
    const groqRes = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: GROQ_MODEL,
        max_tokens: 4000,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: text },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "return_analysis",
              description: "Return the structured BOM audit result.",
              parameters: ANALYSIS_SCHEMA,
            },
          },
        ],
        tool_choice: {
          type: "function",
          function: { name: "return_analysis" },
        },
      }),
    });

    if (!groqRes.ok) {
      const detail = await groqRes.text();
      console.error("groq api error", groqRes.status, detail);
      return NextResponse.json({ error: "Analysis failed. Try again." }, { status: 502 });
    }

    const groqData = await groqRes.json();
    const toolCall = groqData.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall) {
      return NextResponse.json(
        { error: "Model did not return structured data." },
        { status: 502 }
      );
    }

    const result = JSON.parse(toolCall.function.arguments) as {
      items: Omit<AnalyzedItem, "flagged">[];
    };

    const rawItems = result.items;
    const original_total_low = rawItems.reduce((sum, i) => sum + i.cost_low, 0);
    const original_total_high = rawItems.reduce((sum, i) => sum + i.cost_high, 0);
    const avgCost =
      rawItems.length > 0
        ? rawItems.reduce((sum, i) => sum + (i.cost_low + i.cost_high) / 2, 0) / rawItems.length
        : 0;

    const flags = rawItems.map((item) => {
      const midpoint = (item.cost_low + item.cost_high) / 2;
      return (
        item.bucket === "redundant" ||
        (item.bucket === "nice-to-have" && midpoint > avgCost) ||
        item.price_tier_flag === true
      );
    });

    const enrichedItems = await Promise.all(
      rawItems.map(async (item, idx) => {
        if (!ENRICHMENT_ENABLED) return item;
        if (!flags[idx] || item.alternatives.length === 0) return item;
        if (item.bucket === "redundant") return item;
        const real = await fetchRealAlternative(item, apiKey);
        if (!real) return item;
        return { ...item, alternatives: [real, ...item.alternatives.slice(1)] };
      })
    );

    let optimized_total_low = 0;
    let optimized_total_high = 0;

    const items: AnalyzedItem[] = enrichedItems.map((item, idx) => {
      const flagged = flags[idx];

      let optLow = item.cost_low;
      let optHigh = item.cost_high;
      if (flagged && item.alternatives.length > 0) {
        const savings = parseSavingsRange(item.alternatives[0].cost_delta);
        if (savings) {
          optLow = Math.max(0, item.cost_low - savings.max);
          optHigh = Math.max(0, item.cost_high - savings.min);
        }
      }
      optimized_total_low += optLow;
      optimized_total_high += optHigh;

      return { ...item, flagged };
    });

    const originalMid = (original_total_low + original_total_high) / 2;
    const optimizedMid = (optimized_total_low + optimized_total_high) / 2;
    const percent_saved =
      originalMid > 0 ? Number((((originalMid - optimizedMid) / originalMid) * 100).toFixed(1)) : 0;

    const response: AnalyzeResponse = {
      items,
      original_total_low,
      original_total_high,
      optimized_total_low,
      optimized_total_high,
      percent_saved,
    };

    return NextResponse.json(response);
  } catch (err) {
    console.error("analyze route error", err);
    return NextResponse.json({ error: "Analysis failed. Try again." }, { status: 502 });
  }
}
