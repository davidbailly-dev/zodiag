// Sizes shared by the CSS-free layout computation and the entity card, so that the space reserved
// by the layout matches what is actually rendered.
export const NODE_WIDTH = 380;
// A collapsed card only needs room for its name, its file and its fold button.
export const COLLAPSED_WIDTH = 250;
export const HEADER_HEIGHT = 56;
export const ROW_HEIGHT = 26;
export const BODY_PADDING = 8;

export function entityWidth(collapsed = false): number {
    return collapsed ? COLLAPSED_WIDTH : NODE_WIDTH;
}

// A collapsed card only shows its header.
export function entityHeight(fieldCount: number, collapsed = false): number {
    return collapsed ? HEADER_HEIGHT : HEADER_HEIGHT + fieldCount * ROW_HEIGHT + BODY_PADDING;
}
