// Above this number of schemas, cards start collapsed: the full cards no longer fit on one screen.
export const AUTO_COLLAPSE_THRESHOLD = 10;

// Above this number of relations, multiplicity labels are only shown on the highlighted links.
export const DENSE_RELATION_THRESHOLD = 20;

export function initiallyCollapsed(entityNames: readonly string[]): Set<string> {
    return new Set(entityNames.length > AUTO_COLLAPSE_THRESHOLD ? entityNames : []);
}

// One color per source file, spread around the color wheel with the golden angle so that neighbours
// in the list stay distinct. With a single file there is nothing to tell apart, so no color.
export function sourceColors(sources: readonly string[]): Map<string, string> {
    const colors = new Map<string, string>();
    if (sources.length < 2) {
        return colors;
    }
    for (const [index, source] of sources.entries()) {
        colors.set(source, `hsl(${Math.round((index * 137.5) % 360)} 55% 50%)`);
    }
    return colors;
}
