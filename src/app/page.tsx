"use client";

import { useEffect, useMemo, useState } from "react";
import type { AnalyzeResponse, AnalyzedItem, Bucket } from "@/lib/types";

const PLACEHOLDER = `ESP32-WROOM-32 dev board - main controller for the sensor node - $8-10
Custom fabricated aluminum enclosure - already ordered, designed around board footprint - $45
3D printed bracket - mounts the board inside the enclosure - $3
Generic zip ties - cable management - $2
Premium gold-plated header pins - board connections - $15
Second ESP32 dev board - backup controller in case the first fails - $8-10`;

const GENERATE_PROMPT = `I'm building [describe your project in 2-3 sentences — what it does, and whether any part of the design, like a PCB, is already fabricated or ordered, or still just planned]. List every component I'm using, including anything I already own or think is trivial. Format the output exactly like this, one item per line, no extra commentary before or after:

PROJECT: [restate my project in one paragraph, including the fabrication/order status]

PARTS:
1) [specific, identifiable item name] — [one-line reason this item is needed] — [cost, or a range like $5-8; if I need multiple units, give the TOTAL cost for all of them, not the per-unit price]
2) ...

Use specific product names where possible, not vague labels like 'misc parts' or 'hardware kit', so the analysis can actually research alternatives.`;

const TIER_1_10 = [
  "a 2019 Hot Wheels Boneshaker",
  "a Hot Wheels '67 Camaro",
  "a Hot Wheels Twin Mill",
  "one Pokemon booster pack",
  "a Lego minifigure mystery bag",
  "a bag of gummy worms and a soda",
  "a Funko Pop blind box",
  "a Magic 8 Ball",
  "a whoopee cushion",
  "a slap bracelet",
  "a tub of Silly Putty",
  "a scratch-off lottery ticket",
  "a bag of googly eyes",
  "a rubber duck",
  "a tiny joke book",
  "a can of Silly String",
  "a novelty pen shaped like something weird",
  "a mini Rubik's Cube",
  "a bag of plastic army men",
  "a sheet of scratch-and-sniff stickers",
  "a squishy stress ball shaped like a potato",
  "a novelty keychain",
  "a sheet of temporary tattoos",
  "a pack of bubble gum",
  "a bouncy ball the size of a marble",
  "a classic wooden yo-yo",
  "a deck of trick playing cards",
  "a pack of glow sticks",
  "a friendship bracelet kit",
  "a bag of tiny plastic dinosaurs",
  "a wind-up toy robot",
  "a kazoo",
  "a metal Slinky",
  "a mood ring",
  "a pack of trading card sleeves",
  "a pencil-shaped eraser collection",
  "a bubble wand",
  "a Chinese finger trap",
  "a tube of temporary hair chalk",
  "a pack of scratch-off stickers shaped like dinosaurs",
];

const TIER_10_30 = [
  "about a month of Claude Pro",
  "a month of Discord Nitro",
  "a decent burrito every day for a week",
  "a small indie game on the Nintendo eShop",
  "three Lego minifigure mystery bags",
  "a movie ticket plus a large popcorn",
  "a pack of D&D dice with a fancy case",
  "a deck box for your trading cards",
  "a standard Funko Pop (not the blind box kind)",
  "a graphic novel",
  "a fidget spinner gift set",
  "a gaming mousepad the size of a desk",
  "a bag of gourmet beef jerky",
  "one month of a mystery snack subscription box",
  "a fancy scented candle",
  "a board game expansion pack",
  "a small trading card booster box",
  "a phone case that's nicer than your phone",
  "a pair of budget wireless earbuds",
  "a small potted plant and a nice pot",
  "a coffee mug that says something sarcastic",
  "a piece of video game DLC",
  "a month of a random streaming service",
  "pizza and a movie rental for the night",
  "a tarot card deck",
  "a Squishmallow",
  "a suspiciously nice pair of socks",
  "a lava lamp",
  "a desk plant that will probably die",
  "a fancy coffee subscription for a month",
  "a board-game-style escape room kit",
  "a toy karaoke microphone",
  "a small remote control car",
  "a cheap mini drone toy",
  "a pack of nice gel pens",
  "a leather-bound journal",
  "a pair of novelty slippers",
  "a small telescope for backyard stargazing",
  "a beginner harmonica",
  "a pack of scented markers",
];

const TIER_30_75 = [
  "a whole new dev board for your next project",
  "most of a AAA game on sale",
  "a small stack of Pokemon booster boxes",
  "an upgrade for your soldering station",
  "a mechanical keyboard switch tester set",
  "a Steam sale game bundle",
  "a decent pair of wireless earbuds",
  "a newly released indie game at full price",
  "a nice backpack for carrying your gear",
  "a medium-sized board game",
  "pizza for the whole hackathon team",
  "a smartwatch replacement band collection",
  "a bigger camera drone toy",
  "a nice desk lamp with adjustable color temperature",
  "a budget mechanical keyboard",
  "a small-to-medium Lego set",
  "an entry-level graphics tablet",
  "an extra game controller",
  "a solid portable charger",
  "a decent pair of budget headphones",
  "a month of a gym membership",
  "a new pair of everyday shoes",
  "a rugged laptop backpack",
  "an instant camera's worth of film",
  "a small board game collection",
  "a smart plug starter kit",
  "a genuinely nice bluetooth speaker",
  "a pizza oven accessory",
  "a budget fitness tracker",
  "a compact tool kit for your workbench",
  "a sturdy umbrella that survives wind",
  "a decent pair of jeans",
  "a video game season pass",
  "a proper yoga mat",
  "a small countertop appliance",
  "a mid-range pair of wireless earbuds",
  "a cushion for your gaming chair",
  "a spool bundle for your 3D printer",
  "a car detailing kit",
  "another nice backpack, because you can never have too many",
];

const TIER_75_PLUS = [
  "most of the way to a new iPhone... a very old one",
  "a plane ticket somewhere mediocre",
  "a really nice soldering station, twice over",
  "a bundle of Switch games",
  "an entry-level 3D printer",
  "a proper office chair",
  "a basic smartwatch",
  "a pair of real noise-cancelling headphones",
  "a mid-range camera drone",
  "a budget gaming monitor",
  "a used Nintendo Switch Lite",
  "a bus ticket to somewhere far away",
  "a full set of decent bicycle tires",
  "a small designer mug collection",
  "a budget weekend hotel stay",
  "a couple of PS5 games",
  "an electric kettle and toaster combo",
  "a pair of genuinely nice running shoes",
  "a mid-range mechanical keyboard",
  "a two-person kayak paddle set",
  "a budget home espresso machine",
  "a budget stand mixer",
  "a smart video doorbell",
  "a decent camping tent",
  "a pair of concert tickets in the cheap seats",
  "a budget robot vacuum",
  "a basic soundbar",
  "a used pair of AirPods",
  "a gaming headset",
  "a compact mini fridge",
  "a budget home projector",
  "a treadmill desk attachment",
  "a budget pressure washer",
  "a small backyard grill",
  "a portable AC unit for one room",
  "a car dash cam setup",
  "a home security camera kit",
  "two more concert tickets",
  "a full body pillow and a weighted blanket",
  "a well-loved used game console",
];

const WILDCARD = [
  "not even close to one share of Berkshire Hathaway Class A stock",
  "a rounding error on a share of Berkshire Hathaway Class A stock",
];

function pickComparison(savings: number): string | null {
  const rounded = Math.round(savings);
  if (rounded <= 0) return "Nothing to trim here — this list's already lean";

  const pool =
    Math.random() < 1 / 8
      ? WILDCARD
      : rounded < 10
        ? TIER_1_10
        : rounded < 30
          ? TIER_10_30
          : rounded < 75
            ? TIER_30_75
            : TIER_75_PLUS;

  const item = pool[Math.floor(Math.random() * pool.length)];
  return `You saved ~$${rounded} — that's about ${item}.`;
}

const BUCKET_LABEL: Record<Bucket, string> = {
  critical: "Critical",
  important: "Important",
  "nice-to-have": "Nice-to-have",
  redundant: "Redundant",
};

const BUCKET_COLOR: Record<Bucket, string> = {
  critical: "var(--color-critical)",
  important: "var(--color-important)",
  "nice-to-have": "var(--color-nice)",
  redundant: "var(--color-redundant)",
};

function SunIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79Z" />
    </svg>
  );
}

function fmtRange(low: number, high: number) {
  const l = `$${low.toFixed(2).replace(/\.00$/, "")}`;
  if (Math.abs(low - high) < 0.005) return l;
  return `${l}-$${high.toFixed(2).replace(/\.00$/, "")}`;
}

function Dot({ bucket }: { bucket: Bucket }) {
  return (
    <span
      className="inline-block h-2.5 w-2.5 rounded-full shrink-0"
      style={{ backgroundColor: BUCKET_COLOR[bucket] }}
      aria-hidden
    />
  );
}

function ResultRow({ item }: { item: AnalyzedItem }) {
  return (
    <tr className="border-b border-ink/10 align-top">
      <td className="py-3 pr-4">
        <div className="flex items-start gap-2">
          <span className="mt-1.5">
            <Dot bucket={item.bucket} />
          </span>
          <div>
            <div className="font-mono text-sm font-medium">{item.name}</div>
            <div className="text-xs text-ink/60 mt-0.5 max-w-xs">{item.reason}</div>
          </div>
        </div>
      </td>
      <td className="py-3 pr-4 font-mono text-sm whitespace-nowrap">{item.cost}</td>
      <td className="py-3 pr-4 text-sm whitespace-nowrap" style={{ color: BUCKET_COLOR[item.bucket] }}>
        {BUCKET_LABEL[item.bucket]}
        {item.price_tier_flag && (
          <span className="block text-xs text-copper mt-0.5">overpriced for spec</span>
        )}
      </td>
      <td className="py-3 pr-4 text-sm">
        {item.flagged ? (
          <span className="font-mono text-copper">flagged</span>
        ) : (
          <span className="font-mono text-ink/30">—</span>
        )}
      </td>
      <td className="py-3">
        {item.alternatives.length > 0 && (
          <ul className="space-y-2">
            {item.alternatives.map((alt, i) => (
              <li key={i} className="border-l-2 border-copper/40 pl-3">
                <div className="flex flex-wrap items-baseline gap-x-2">
                  <span className="text-sm font-medium">{alt.name}</span>
                  <span className="font-mono text-xs text-important">{alt.cost_delta}</span>
                </div>
                <div className="text-xs text-ink/70 mt-1">
                  <span className="font-medium text-important">pro:</span> {alt.pro}
                </div>
                <div className="text-xs text-ink/70">
                  <span className="font-medium text-redundant">con:</span> {alt.con}
                </div>
              </li>
            ))}
          </ul>
        )}

        {item.platform_note && item.platform_alternatives.length > 0 && (
          <div className="mt-3 border border-ink/20 bg-ink/[0.03] p-3 rounded-sm">
            <div className="text-xs font-sans font-medium uppercase tracking-wide text-ink/60 mb-2">
              Platform options
            </div>
            <ul className="space-y-2">
              {item.platform_alternatives.map((alt, i) => (
                <li key={i} className="border-l-2 border-ink/25 pl-3">
                  <div className="flex flex-wrap items-baseline gap-x-2">
                    <span className="text-sm font-medium">{alt.name}</span>
                    <span className="font-mono text-xs text-ink/60">{alt.cost_delta}</span>
                  </div>
                  <div className="text-xs text-ink/70 mt-1">
                    <span className="font-medium">pro:</span> {alt.pro}
                  </div>
                  <div className="text-xs text-ink/70">
                    <span className="font-medium">con:</span> {alt.con}
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}
      </td>
    </tr>
  );
}

export default function Home() {
  const [input, setInput] = useState("");
  const [result, setResult] = useState<AnalyzeResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setMounted(true);
    const attr = document.documentElement.getAttribute("data-theme");
    if (attr === "dark" || attr === "light") setTheme(attr);
  }, []);

  function toggleTheme() {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    document.documentElement.setAttribute("data-theme", next);
    localStorage.setItem("theme", next);
  }

  async function copyPrompt() {
    try {
      await navigator.clipboard.writeText(GENERATE_PROMPT);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard unavailable — button just won't show "Copied!" */
    }
  }

  async function analyze() {
    console.log("analyze() clicked");
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: input }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Analysis failed.");
      setResult(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Analysis failed.");
    } finally {
      setLoading(false);
    }
  }

  const comparison = useMemo(() => {
    if (!result) return null;
    const originalMid = (result.original_total_low + result.original_total_high) / 2;
    const optimizedMid = (result.optimized_total_low + result.optimized_total_high) / 2;
    return pickComparison(originalMid - optimizedMid);
  }, [result]);

  return (
    <div className="flex-1 w-full max-w-5xl mx-auto px-6 py-10">
      <header className="border-b border-ink/15 pb-5 mb-8 flex items-start justify-between gap-4">
        <div>
          <h1 className="font-sans text-2xl font-bold tracking-tight">
            Budget<span className="text-copper">Forge</span>
          </h1>
          <p className="text-sm text-ink/60 mt-1">
            Paste your parts list. Get a necessity audit and lower-cost alternatives.
          </p>
        </div>
        <button
          onClick={toggleTheme}
          aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
          className="shrink-0 h-8 w-8 flex items-center justify-center border border-ink/20 rounded-sm text-ink/70 hover:text-copper hover:border-copper transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-copper"
        >
          {theme === "dark" ? <SunIcon /> : <MoonIcon />}
        </button>
      </header>

      <section>
        <label htmlFor="parts" className="block text-sm font-medium mb-2">
          Parts list
        </label>
        <textarea
          id="parts"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={PLACEHOLDER}
          rows={10}
          className="w-full border border-ink/25 bg-surface font-mono text-sm p-3 rounded-sm placeholder:text-ink/40 focus:outline-none focus-visible:ring-2 focus-visible:ring-copper focus-visible:border-copper resize-y"
        />
        <p className="text-xs text-ink/50 mt-1.5">
          One item per line: name — reason — cost (a range like $5-8 is fine).
        </p>

        <details className="group mt-4">
          <summary className="list-none cursor-pointer flex items-center gap-1.5 text-xs text-ink/45 hover:text-ink/70 transition-colors select-none">
            <span className="inline-block text-[10px] transition-transform group-open:rotate-90">▸</span>
            Don&apos;t have a list handy? Copy this into your project&apos;s AI assistant
          </summary>
          <div className="mt-2 border border-ink/10 rounded-sm p-3 bg-ink/[0.02]">
            <pre className="font-mono text-xs text-ink/60 whitespace-pre-wrap leading-relaxed">{GENERATE_PROMPT}</pre>
            <button
              type="button"
              onClick={copyPrompt}
              className="mt-2 font-mono text-xs text-copper hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-copper rounded-sm"
            >
              {copied ? "Copied!" : "Copy prompt"}
            </button>
          </div>
        </details>

        <button
          onClick={analyze}
          disabled={!mounted || loading || !input.trim()}
          className="mt-4 bg-ink text-paper font-sans font-medium text-sm px-5 py-2.5 rounded-sm hover:bg-copper transition-colors disabled:opacity-40 disabled:hover:bg-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-copper focus-visible:ring-offset-2 focus-visible:ring-offset-paper"
        >
          {!mounted ? "Loading…" : loading ? "Analyzing…" : "Analyze"}
        </button>

        {error && (
          <p className="mt-3 text-sm text-redundant" role="alert">
            {error}
          </p>
        )}
      </section>

      {result && (
        <section className="mt-10">
          <div className="border-t border-ink/15 pt-6 overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[720px]">
              <thead>
                <tr className="border-b border-ink/25 text-xs uppercase tracking-wide text-ink/50">
                  <th className="py-2 pr-4 font-medium">Item</th>
                  <th className="py-2 pr-4 font-medium">Cost</th>
                  <th className="py-2 pr-4 font-medium">Bucket</th>
                  <th className="py-2 pr-4 font-medium">Flagged</th>
                  <th className="py-2 font-medium">Alternatives</th>
                </tr>
              </thead>
              <tbody>
                {result.items.map((item, i) => (
                  <ResultRow key={i} item={item} />
                ))}
              </tbody>
            </table>
          </div>

          <div className="border-t border-ink/15 mt-8 pt-6 flex flex-wrap gap-x-10 gap-y-3">
            <div>
              <div className="text-xs uppercase tracking-wide text-ink/50">Original total</div>
              <div className="font-mono text-lg mt-1">
                {fmtRange(result.original_total_low, result.original_total_high)}
              </div>
            </div>
            <div>
              <div className="text-xs uppercase tracking-wide text-ink/50">Optimized total</div>
              <div className="font-mono text-lg mt-1 text-important">
                {fmtRange(result.optimized_total_low, result.optimized_total_high)}
              </div>
            </div>
            <div>
              <div className="text-xs uppercase tracking-wide text-ink/50">Saved</div>
              <div className="font-mono text-lg mt-1 text-copper">{result.percent_saved.toFixed(1)}%</div>
            </div>
          </div>

          {comparison && <p className="mt-4 text-sm text-ink/70">{comparison}</p>}
        </section>
      )}
    </div>
  );
}
