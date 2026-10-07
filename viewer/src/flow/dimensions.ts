// Sizes shared by the CSS-free layout computation and the entity card, so that the space reserved
// by the layout matches what is actually rendered.
export const NODE_WIDTH = 380;
export const HEADER_HEIGHT = 56;
export const ROW_HEIGHT = 26;
export const BODY_PADDING = 8;

export function entityHeight(fieldCount: number): number {
    return HEADER_HEIGHT + fieldCount * ROW_HEIGHT + BODY_PADDING;
}
