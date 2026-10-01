/** Lobby-card icon: two cards, one face-up with a star. */
export function MemoryIcon(props) {
  return (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      {...props}
    >
      <rect x="2.5" y="5" width="9.5" height="14" rx="2.2" fill="currentColor" opacity="0.4" />
      <rect x="12" y="5" width="9.5" height="14" rx="2.2" />
      <path
        d="m16.75 8.6.9 1.9 2.1.3-1.5 1.5.35 2.1-1.85-1-1.85 1 .35-2.1-1.5-1.5 2.1-.3.9-1.9Z"
        fill="currentColor"
        stroke="none"
      />
    </svg>
  );
}

export default MemoryIcon;
