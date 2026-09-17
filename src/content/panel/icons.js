// Minimal stroke-based icon set (static, no interpolated data — safe to
// use via innerHTML). Unicode glyphs like ✕/✓ render inconsistently across
// platforms and read as a placeholder; real SVG is what a finished product
// actually ships.
const svg = (body, size = 14) =>
  `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${body}</svg>`;

export const ICON_CLOSE = svg(`<path d="M18 6 6 18M6 6l12 12"/>`, 13);
export const ICON_CHECK = svg(`<path d="M20 6 9 17l-5-5"/>`, 13);
export const ICON_CLOCK = svg(`<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 3"/>`, 13);
export const ICON_LAYERS = svg(
  `<path d="m12 3 8 4.5-8 4.5-8-4.5L12 3Z"/><path d="m4 12.5 8 4.5 8-4.5"/>`,
  13
);
export const ICON_TARGET = svg(
  `<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="4.5"/><circle cx="12" cy="12" r="1" fill="currentColor" stroke="none"/>`,
  13
);
export const ICON_ALERT = svg(
  `<path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z"/><path d="M12 9v4M12 17h.01"/>`,
  13
);
export const ICON_VERIFIED = svg(`<circle cx="12" cy="12" r="9"/><path d="m8 12 3 3 5-6"/>`, 11);
