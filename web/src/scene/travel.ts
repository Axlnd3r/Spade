// A page change, in seconds: the camera dives into the card, the tunnel holds the whole view,
// then the next page emerges. The pages swap when the hold ends.
export const DIVE_S = 0.45;
export const HOLD_S = 0.45;
export const EMERGE_S = 0.6;
/** How long a page waits, from the click, before the next one replaces it. */
export const SWAP_MS = (DIVE_S + HOLD_S) * 1000;
