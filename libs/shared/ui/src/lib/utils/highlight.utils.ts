export interface HighlightSegment {
  text: string;
  match: boolean;
}

/**
 * Splits `text` into matched/unmatched segments against `query` for search-result highlighting.
 * Returns plain text segments (never HTML) so callers render matches via `@for` + `<mark>`
 * instead of an `[innerHTML]` binding — avoids any need to sanitize restaurant-authored text.
 *
 * @example @for (segment of highlightSegments(item.name, search()); track $index) {
 *            @if (segment.match) { <mark>{{ segment.text }}</mark> } @else { {{ segment.text }} }
 *          }
 */
export function highlightSegments(text: string, query: string): HighlightSegment[] {
  const trimmedQuery = query.trim();
  if (!trimmedQuery) {
    return [{ text, match: false }];
  }

  const escapedQuery = trimmedQuery.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const pattern = new RegExp(`(${escapedQuery})`, 'gi');

  // `split` on a single-capturing-group regex always alternates [nonmatch, match, nonmatch, …]
  // starting at index 0 — compute the match flag from that parity before filtering empty parts,
  // since filtering first would shift the parity whenever a match falls at the very start/end.
  return text
    .split(pattern)
    .map((part, index) => ({ text: part, match: index % 2 === 1 }))
    .filter((segment) => segment.text.length > 0);
}
