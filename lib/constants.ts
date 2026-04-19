// ---------------------------------------------------------------------------
// Design constants — colors, labels, ordering
// All dataset/speaker/section values that need visual treatment are here.
// If a new dataset or value is added, add it here with a fallback.
// ---------------------------------------------------------------------------

import type { Dataset, SpeakerGroup, NTSection } from "./types";

// Dataset colors — earthy editorial palette
// ⚠ Keep in sync with --color-ds-* tokens in app/globals.css
export const DATASET_COLORS: Record<Dataset, string> = {
  A: "#2a9d8f", // earthy teal
  B: "#457b9d", // dusty slate-blue
  D: "#e76f51", // coral / terracotta
};

// ---------------------------------------------------------------------------
// OT / ANE ethical-root taxonomy
//
// Categorizes each NT command by the register of its underlying OT/ANE
// ethical root, which can differ from its NT dataset classification.
// Example: "do not move the boundary stone" is a NT-era communal-life
// command whose ANE root is Justice & Mercy (protecting weaker neighbors
// from being defrauded by boundary drift).
//
// The admin UI renders these as a dropdown with a free-text "Other…" escape
// for edge cases; new consensus categories can be promoted into this list
// over time.
// ---------------------------------------------------------------------------

export const OT_ROOT_CATEGORIES = [
  "Covenant Loyalty",            // worship, sabbath, exclusive allegiance to YHWH
  "Justice & Mercy",             // protecting the weak (widow, orphan, stranger)
  "Economic Compassion",         // debt release, Jubilee, gleaning, generous lending
  "Sexual Ethics & Family Order", // marriage, adultery, inheritance
  "Ritual Purity",               // clean/unclean, sacrifice, holy days
  "Communal Peace & Honor",      // honor parents, no murder, communal harmony
  "Wisdom & Character",          // speech, work ethic, humility, fear of the Lord
  "Land & Creation Care",        // stewardship, sabbath for land, animal welfare
] as const;

export type OTRootCategory = typeof OT_ROOT_CATEGORIES[number];

export const DATASET_COLORS_LIGHT: Record<Dataset, string> = {
  A: "#d4f0ed", // soft teal tint
  B: "#daeaf3", // soft blue tint
  D: "#fde8e2", // soft coral tint
};

export const DATASET_LABELS: Record<Dataset, string> = {
  A: "Mercy & Justice",
  B: "Core Doctrine",
  D: "Social Codes",
};

export const DATASET_ORDER: Dataset[] = ["A", "B", "D"];

// Commonly cited accent color — amber, used as a filter/tag indicator
export const COMMONLY_CITED_COLOR = "#d97706"; // amber-600
export const COMMONLY_CITED_COLOR_LIGHT = "#fef3c7"; // amber-100

// Speaker group colors — neutral palette, Jesus highlighted
export const SPEAKER_COLORS: Record<SpeakerGroup, string> = {
  Jesus:            "#7c3aed", // violet-700
  Paul:             "#0369a1", // sky-700
  Peter:            "#047857", // emerald-700
  John:             "#b45309", // amber-700
  James:            "#be185d", // pink-700
  Hebrews:          "#6b7280", // gray-500
  "John the Baptist": "#92400e", // amber-900
  Jude:             "#9ca3af", // gray-400
  Other:            "#d1d5db", // gray-300
};

export const NT_SECTION_ORDER: NTSection[] = [
  "Gospels",
  "Acts",
  "Pauline Epistles",
  "General Epistles",
  "Revelation",
];

// Canonical NT book order — all 27 books
export const BOOK_ORDER: string[] = [
  "Matthew", "Mark", "Luke", "John",
  "Acts",
  "Romans", "1 Corinthians", "2 Corinthians", "Galatians", "Ephesians",
  "Philippians", "Colossians", "1 Thessalonians", "2 Thessalonians",
  "1 Timothy", "2 Timothy", "Titus", "Philemon",
  "Hebrews", "James", "1 Peter", "2 Peter",
  "1 John", "2 John", "3 John", "Jude",
  "Revelation",
];

export const BOOK_ABBREVIATIONS: Record<string, string> = {
  Matthew:           "Matt",
  Mark:              "Mark",
  Luke:              "Luke",
  John:              "John",
  Acts:              "Acts",
  Romans:            "Rom",
  "1 Corinthians":   "1 Cor",
  "2 Corinthians":   "2 Cor",
  Galatians:         "Gal",
  Ephesians:         "Eph",
  Philippians:       "Phil",
  Colossians:        "Col",
  "1 Thessalonians": "1 Thess",
  "2 Thessalonians": "2 Thess",
  "1 Timothy":       "1 Tim",
  "2 Timothy":       "2 Tim",
  Titus:             "Titus",
  Philemon:          "Phlm",
  Hebrews:           "Heb",
  James:             "Jas",
  "1 Peter":         "1 Pet",
  "2 Peter":         "2 Pet",
  "1 John":          "1 Jn",
  "2 John":          "2 Jn",
  "3 John":          "3 Jn",
  Jude:              "Jude",
  Revelation:        "Rev",
};

// Section color for book axis node bars (groups books visually by their section)
export const NT_SECTION_COLORS: Record<NTSection, string> = {
  "Gospels":          "#6d28d9", // violet-700
  "Acts":             "#0369a1", // sky-700
  "Pauline Epistles": "#1d4ed8", // blue-700
  "General Epistles": "#047857", // emerald-700
  "Revelation":       "#b91c1c", // red-700
};

// Which section each book belongs to (for node coloring on the book axis)
export const BOOK_TO_SECTION: Record<string, NTSection> = {
  Matthew: "Gospels", Mark: "Gospels", Luke: "Gospels", John: "Gospels",
  Acts: "Acts",
  Romans: "Pauline Epistles", "1 Corinthians": "Pauline Epistles",
  "2 Corinthians": "Pauline Epistles", Galatians: "Pauline Epistles",
  Ephesians: "Pauline Epistles", Philippians: "Pauline Epistles",
  Colossians: "Pauline Epistles", "1 Thessalonians": "Pauline Epistles",
  "2 Thessalonians": "Pauline Epistles", "1 Timothy": "Pauline Epistles",
  "2 Timothy": "Pauline Epistles", Titus: "Pauline Epistles",
  Philemon: "Pauline Epistles",
  Hebrews: "General Epistles", James: "General Epistles",
  "1 Peter": "General Epistles", "2 Peter": "General Epistles",
  "1 John": "General Epistles", "2 John": "General Epistles",
  "3 John": "General Epistles", Jude: "General Epistles",
  Revelation: "Revelation",
};

export const SPEAKER_ORDER: SpeakerGroup[] = [
  "Jesus",
  "Paul",
  "Peter",
  "John",
  "James",
  "Hebrews",
  "John the Baptist",
  "Jude",
  "Other",
];

// Fallback for any unknown value that appears after a data update
export function datasetColor(dataset: string): string {
  return DATASET_COLORS[dataset as Dataset] ?? "#94a3b8";
}

export function speakerColor(speaker: string): string {
  return SPEAKER_COLORS[speaker as SpeakerGroup] ?? "#94a3b8";
}
