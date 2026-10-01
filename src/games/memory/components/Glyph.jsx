/**
 * The picture on a card: one of 18 symbols = 6 shapes × 3 colours
 * (`id % 6` picks the shape, `floor(id / 6)` the colour). Drawn in SVG, so no assets.
 */
const SHAPES = [
  <circle key="circle" cx="12" cy="12" r="8" />,
  <rect key="square" x="4.5" y="4.5" width="15" height="15" rx="3" />,
  <path key="triangle" d="M12 4 21 19H3Z" strokeLinejoin="round" />,
  <path
    key="star"
    d="m12 3 2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9L12 3Z"
    strokeLinejoin="round"
  />,
  <path key="heart" d="M12 20S4 14.6 4 9.2A4.2 4.2 0 0 1 12 7a4.2 4.2 0 0 1 8 2.2C20 14.6 12 20 12 20Z" />,
  <path key="diamond" d="m12 3 8 9-8 9-8-9 8-9Z" strokeLinejoin="round" />,
];

/** Colour tokens: red, blue, green. */
const COLORS = ['var(--player-4-color)', 'var(--player-2-color)', 'var(--player-1-color)'];
const DARK = ['var(--player-4-dark)', 'var(--player-2-dark)', 'var(--player-1-dark)'];

export const SHAPE_COUNT = SHAPES.length;

/** @param {{ id: number }} props */
export function Glyph({ id }) {
  const shape = id % SHAPE_COUNT;
  const color = Math.floor(id / SHAPE_COUNT) % COLORS.length;
  return (
    <svg
      viewBox="0 0 24 24"
      fill={COLORS[color]}
      stroke={DARK[color]}
      strokeWidth="1.8"
      aria-hidden="true"
      focusable="false"
    >
      {SHAPES[shape]}
    </svg>
  );
}

export default Glyph;
