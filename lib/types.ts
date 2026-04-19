// ---------------------------------------------------------------------------
// Core record type — mirrors the schema in nt_data.json
// All fields match what build_data.py outputs. If a field is added to the
// pipeline, add it here. Optional fields are things only Dataset D has.
// ---------------------------------------------------------------------------

export type Dataset = "A" | "B" | "D";

export type SpeakerGroup =
  | "Jesus"
  | "Paul"
  | "Peter"
  | "John"
  | "James"
  | "Hebrews"
  | "John the Baptist"
  | "Jude"
  | "Other";

export type NTSection =
  | "Gospels"
  | "Acts"
  | "Pauline Epistles"
  | "General Epistles"
  | "Revelation";

export type Q2Score = "Y" | "N" | "P";
export type ConsistencyRating =
  | "CONSISTENT"
  | "PARTIALLY CONSISTENT"
  | "SELECTIVE"
  | "INCONSISTENT";

export interface NTRecord {
  // Identity
  book: string;
  chapter: string;
  verse_range: string;
  ref: string;
  url: string;

  // Classification
  dataset: Dataset;
  dataset_label: string;
  nt_section: NTSection;
  category: string;
  category_code: string;
  theme: string;
  subtheme: string;

  // Context
  literary_context: string;
  passage_type: string;
  passage_type_group: string;
  command_strength: string;
  command_strength_group: string;

  // Attribution
  speaker: string;
  speaker_group: SpeakerGroup;
  audience: string;

  // Scholarly apparatus
  parallel_passages: string;
  parallel_id: string;
  primary_record: boolean;
  gk_keywords: string;
  ot_antecedent: string;
  summary: string;
  interpretive_notes: string;

  // OT / ANE ethical root — captures the historical ethical register,
  // which may differ from the NT dataset classification.
  // Example: "do not move the boundary stone" is an NT-era communal-life
  // command whose ANE root is a justice-and-mercy protection of weaker
  // neighbors from being defrauded.
  ot_root_category: string | null;
  ot_root_notes:    string | null;

  // Emphasis tag — true if this passage is among the commonly cited passages
  commonly_cited: boolean;

  // Admin metadata (present only for DB-backed records)
  id?:         number;
  created_at?: string;
  updated_at?: string;

  // Q2 fields — only populated for Dataset D records
  q2_crg: Q2Score | null;
  q2_pfs: Q2Score | null;
  q2_uca: Q2Score | null;
  q2_ic: Q2Score | null;
  q2_mca: Q2Score | null;
  q2_typical_application: string | null;
  q2_consistency_rating: ConsistencyRating | null;
  q2_notes: string | null;
}

// ---------------------------------------------------------------------------
// Aggregates type — mirrors nt_aggregates.json
// ---------------------------------------------------------------------------

export interface DatasetTotal {
  dataset: Dataset;
  label: string;
  total: number;
  direct_imperatives: number;
  jesus_speaker: number;
  commonly_cited: number;
  pct_of_abd: number;
}

export interface SpeakerBreakdown {
  speaker_group: SpeakerGroup;
  dataset_A: number;
  dataset_B: number;
  dataset_D: number;
  total: number;
}

export interface NTSectionBreakdown {
  nt_section: NTSection;
  dataset_A: number;
  dataset_B: number;
  dataset_D: number;
  total: number;
}

export interface KeyRatios {
  mercy_vs_doctrine: number;
  mercy_vs_commonly_cited: number;
  gospels_mercy_vs_doctrine: number;
  jesus_mercy_pct: number;
  jesus_doctrine_pct: number;
  abd_total: number;
  commonly_cited_total: number;
}

export interface Q2Summary {
  CONSISTENT: number;
  "PARTIALLY CONSISTENT": number;
  SELECTIVE: number;
  INCONSISTENT: number;
  unscored: number;
}

export interface Aggregates {
  dataset_totals: DatasetTotal[];
  abd_total: number;
  commonly_cited_total: number;
  category_counts: Record<string, number>;
  speaker_breakdown: SpeakerBreakdown[];
  nt_section_breakdown: NTSectionBreakdown[];
  key_ratios: KeyRatios;
  q2_summary: Q2Summary;
  passage_type_breakdown: Array<{
    passage_type_group: string;
    dataset_A: number;
    dataset_B: number;
    dataset_D: number;
    total: number;
  }>;
}
