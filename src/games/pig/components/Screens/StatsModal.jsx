import { leaderboard } from '../../utils/stats.js';
import { useI18n } from '../../../../shared/i18n/index.jsx';
import { Modal } from '../../../../shared/ui/Modal.jsx';
import './StatsModal.css';

/**
 * Lifetime stats for the humans who have played on this device.
 *
 * @param {object} props
 * @param {boolean} props.open
 * @param {ReturnType<typeof import('../../utils/stats.js').emptyStats>} props.stats
 * @param {() => void} props.onClose
 * @param {() => void} props.onReset
 */
export function StatsModal({ open, stats, onClose, onReset }) {
  const { t, n } = useI18n();
  const rows = leaderboard(stats);

  return (
    <Modal
      open={open}
      title={t('stats.title')}
      description={rows.length === 0 ? t('stats.empty') : undefined}
      onClose={onClose}
      actions={[
        { label: t('stats.close'), variant: 'secondary', onClick: onClose, autofocus: true },
        ...(rows.length > 0 ? [{ label: t('stats.reset'), variant: 'danger', onClick: onReset }] : []),
      ]}
    >
      {rows.length > 0 ? (
        <div className="stats__scroll">
          <table className="stats">
            <thead>
              <tr>
                <th scope="col">{t('stats.player')}</th>
                <th scope="col">{t('stats.wins')}</th>
                <th scope="col">{t('stats.games')}</th>
                <th scope="col">{t('stats.busts')}</th>
                <th scope="col">{t('stats.best')}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.name}>
                  <th scope="row">{row.name}</th>
                  <td>{n(row.wins)}</td>
                  <td>{n(row.games)}</td>
                  <td>{row.rolls > 0 ? `${n(Math.round((row.busts / row.rolls) * 100))}%` : '–'}</td>
                  <td>{n(row.bestTurn)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </Modal>
  );
}

export default StatsModal;
