import { useEffect, useId, useRef } from 'react';
import { useI18n } from '../i18n/index.jsx';
import { Button } from './Button.jsx';
import { CloseIcon } from './icons.jsx';
import './Modal.css';

/**
 * Focus-managed modal dialog (no portal needed — it is rendered at the root of
 * the screen it belongs to). Handles Escape, backdrop clicks, focus restoration
 * and a simple Tab cycle so keyboard users can never escape the dialog.
 *
 * @param {object} props
 * @param {boolean} props.open
 * @param {string} props.title
 * @param {() => void} props.onClose
 * @param {Array<{label: string, onClick: () => void, variant?: string}>} [props.actions]
 */
export function Modal({ open, title, description, children, actions = [], onClose, dismissOnBackdrop = true }) {
  const { t } = useI18n();
  const panelRef = useRef(null);
  const previouslyFocused = useRef(null);
  const titleId = useId();
  const descriptionId = useId();
  // Keep the latest handler without re-running the setup effect (which would
  // steal focus back to the panel on every parent render).
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  useEffect(() => {
    if (!open) return undefined;

    previouslyFocused.current = document.activeElement;
    const panel = panelRef.current;
    const focusable = panel?.querySelector('[data-autofocus]') ?? panel;
    focusable?.focus?.();

    // Lock background scrolling while the dialog owns the screen.
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const onKeyDown = (event) => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        closeRef.current?.();
        return;
      }
      if (event.key !== 'Tab' || !panel) return;

      const items = panel.querySelectorAll(
        'button:not([disabled]), [href], input:not([disabled]), select, textarea, [tabindex]:not([tabindex="-1"])',
      );
      if (!items.length) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', onKeyDown, true);
    return () => {
      document.removeEventListener('keydown', onKeyDown, true);
      document.body.style.overflow = previousOverflow;
      previouslyFocused.current?.focus?.();
    };
  }, [open]);

  if (!open) return null;

  return (
    <div
      className="modal"
      onMouseDown={(event) => {
        if (dismissOnBackdrop && event.target === event.currentTarget) closeRef.current?.();
      }}
    >
      <div
        className="modal__panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descriptionId : undefined}
        ref={panelRef}
        tabIndex={-1}
      >
        <button
          type="button"
          className="modal__close"
          aria-label={t('modal.close')}
          onClick={() => closeRef.current?.()}
        >
          <CloseIcon />
        </button>

        <h2 className="modal__title" id={titleId}>
          {title}
        </h2>
        {description ? (
          <p className="modal__description" id={descriptionId}>
            {description}
          </p>
        ) : null}

        {children ? <div className="modal__body">{children}</div> : null}

        {actions.length > 0 ? (
          <div className="modal__actions">
            {actions.map((action, index) => (
              <Button
                key={action.label}
                variant={action.variant ?? (index === 0 ? 'secondary' : 'primary')}
                onClick={action.onClick}
                block
                data-autofocus={action.autofocus ? 'true' : undefined}
              >
                {action.label}
              </Button>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}

export default Modal;
