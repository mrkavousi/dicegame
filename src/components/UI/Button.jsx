import './Button.css';

/**
 * The game's chunky button. Every visual property comes from design tokens:
 * a hard "lip" (0-blur shadow) that disappears when the button is pressed,
 * exactly like a physical arcade button.
 *
 * @param {object} props
 * @param {'primary'|'bank'|'danger'|'secondary'|'ghost'} [props.variant]
 * @param {'md'|'lg'} [props.size]
 * @param {boolean} [props.block] full width
 * @param {boolean} [props.pulse] draw attention (used when the pot is worth banking)
 * @param {string} [props.shortcut] keyboard hint rendered inside the button
 */
export function Button({
  variant = 'primary',
  size = 'md',
  block = false,
  pulse = false,
  shortcut,
  icon = null,
  type = 'button',
  className = '',
  children,
  ...rest
}) {
  const classes = [
    'btn',
    `btn--${variant}`,
    `btn--${size}`,
    block ? 'btn--block' : '',
    pulse ? 'btn--pulse' : '',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <button type={type} className={classes} {...rest}>
      {icon ? <span className="btn__icon">{icon}</span> : null}
      <span className="btn__label">{children}</span>
      {shortcut ? (
        <kbd className="btn__kbd" aria-hidden="true">
          {shortcut}
        </kbd>
      ) : null}
    </button>
  );
}

export default Button;
