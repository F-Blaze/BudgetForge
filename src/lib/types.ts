export type Bucket = "critical" | "important" | "nice-to-have" | "redundant";

export type Alternative = {
  name: string;
  cost_delta: string;
  pro: string;
  con: string;
};

export type AnalyzedItem = {
  name: string;
  reason: string;
  cost: string;
  cost_low: number;
  cost_high: number;
  bucket: Bucket;
  price_tier_flag: boolean;
  flagged: boolean;
  alternatives: Alternative[];
  platform_note: boolean;
  platform_alternatives: Alternative[];
};

export type AnalyzeResponse = {
  items: AnalyzedItem[];
  original_total_low: number;
  original_total_high: number;
  optimized_total_low: number;
  optimized_total_high: number;
  percent_saved: number;
};
