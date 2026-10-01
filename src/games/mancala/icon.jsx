/** Lobby-card icon: a row of pits with stones and a store at each end. */
export function MancalaIcon(props) {
  return (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      aria-hidden="true"
      focusable="false"
      {...props}
    >
      <rect x="2" y="6" width="20" height="12" rx="6" />
      <circle cx="8" cy="9.5" r="1.4" fill="currentColor" stroke="none" />
      <circle cx="12" cy="9.5" r="1.4" fill="currentColor" stroke="none" />
      <circle cx="16" cy="9.5" r="1.4" fill="currentColor" stroke="none" />
      <circle cx="8" cy="14.5" r="1.4" fill="currentColor" stroke="none" />
      <circle cx="12" cy="14.5" r="1.4" fill="currentColor" stroke="none" />
      <circle cx="16" cy="14.5" r="1.4" fill="currentColor" stroke="none" />
    </svg>
  );
}

export default MancalaIcon;
