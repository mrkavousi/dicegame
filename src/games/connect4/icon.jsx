/** Lobby-card icon: a little Connect Four grid with a row of discs. */
export function Connect4Icon(props) {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" focusable="false" {...props}>
      <rect x="2" y="3" width="20" height="18" rx="4" fill="none" stroke="currentColor" strokeWidth="2.2" />
      <circle cx="7" cy="8" r="1.7" />
      <circle cx="12" cy="8" r="1.7" opacity="0.45" />
      <circle cx="17" cy="8" r="1.7" opacity="0.45" />
      <circle cx="7" cy="12.5" r="1.7" opacity="0.45" />
      <circle cx="12" cy="12.5" r="1.7" />
      <circle cx="17" cy="12.5" r="1.7" opacity="0.45" />
      <circle cx="7" cy="17" r="1.7" />
      <circle cx="12" cy="17" r="1.7" />
      <circle cx="17" cy="17" r="1.7" />
    </svg>
  );
}

export default Connect4Icon;
