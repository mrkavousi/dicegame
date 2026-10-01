/** Lobby-card icon: a 3×3 grid of dots with one completed box. */
export function DotsIcon(props) {
  const dots = [4, 12, 20];
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" focusable="false" {...props}>
      <rect x="4" y="4" width="8" height="8" fill="currentColor" opacity="0.3" />
      <path
        d="M4 4h8v8H4zM12 4h8M4 12v8M12 12h8M12 12v8"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
      {dots.flatMap((x) => dots.map((y) => <circle key={`${x}-${y}`} cx={x} cy={y} r="2.1" />))}
    </svg>
  );
}

export default DotsIcon;
