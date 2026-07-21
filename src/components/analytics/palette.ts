// Categorical palette for the /market-data/ charts. HumanSourcer is
// dark-only (see global.css), so this is a single dark-mode set — not a
// light/dark pair. Fixed order = the CVD-safety mechanism (never cycle,
// never reassign by rank): validated with the dataviz skill's
// validate_palette.js against this site's actual dark surface
// (--color-surface: #100e13), not a generic default.
export const CATEGORICAL: string[] = [
  '#3987e5', // blue
  '#199e70', // aqua
  '#c98500', // yellow
  '#008300', // green
  '#9085e9', // violet
  '#e66767', // red
  '#d55181', // magenta
  '#d95926', // orange
];

// For an "everything else" bucket in a top-N-plus-other breakdown — never a
// 9th categorical hue (folding into Other is the prescribed move, not
// generating a new color).
export const OTHER_COLOR = '#5a5766'; // between --color-border-strong and --color-ink-tertiary

export function seriesColor(index: number): string {
  return CATEGORICAL[index % CATEGORICAL.length];
}
