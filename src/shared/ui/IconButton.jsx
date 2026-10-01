import './IconButton.css';

/**
 * Compact, touch-friendly icon button for toolbars and headers.
 * Always requires an accessible `label` — icons alone are not accessible.
 *
 * @param {object} props
 * @param {string} props.label accessible name (and tooltip)
 * @param {boolean} [props.active] toggled state (renders `aria-pressed`)
 */
export function IconButton({ label, icon, active = false, size = 'md', className = '', ...rest }) {
  const classes = ['icon-btn', `icon-btn--${size}`, active ? 'is-active' : '', className]
    .filter(Boolean)
    .join(' ');

  return (
    <button
      type="button"
      className={classes}
      aria-label={label}
      title={label}
      aria-pressed={active ? true : undefined}
      {...rest}
    >
      {icon}
    </button>
  );
}

export default IconButton;
