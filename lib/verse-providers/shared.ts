// ---------------------------------------------------------------------------
// Shared helpers used by every verse provider.
// ---------------------------------------------------------------------------

/**
 * Every provider returns the same shape: a map from verse number → text, or
 * null when that verse couldn't be fetched (past chapter end, empty result,
 * etc.). The dispatcher merges English and Greek into the final response.
 */
export type VerseMap = Map<number, string | null>;

/** Thrown when the API rejects the key (403) — surface clearly to the user. */
export class AccessDeniedError extends Error {
  constructor(public provider: string, public detail?: string) {
    super(`Access denied by ${provider}${detail ? `: ${detail}` : ""}`);
  }
}

/** Strip any HTML tags and decode common entities. */
export function stripHtml(html: string): string {
  return html
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&ldquo;/g, "\u201c")
    .replace(/&rdquo;/g, "\u201d")
    .replace(/&lsquo;/g, "\u2018")
    .replace(/&rsquo;/g, "\u2019")
    .replace(/&mdash;/g, "\u2014")
    .replace(/&ndash;/g, "\u2013")
    .replace(/&hellip;/g, "\u2026")
    .replace(/\s+/g, " ")
    .trim();
}
