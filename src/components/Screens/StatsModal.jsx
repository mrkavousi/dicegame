import { leaderboard } from '../../utils/stats.js';
import { Modal } from '../UI/Modal.jsx';
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
  const rows = leaderboard(stats);

  return (
    <Modal
      open={open}
      title="Lifetime stats"
      description={rows.length === 0 ? 'No finished games yet — play one to start the leaderboard.' : undefined}
      onClose={onClose}
      actions={[
        { label: 'Close', variant: 'secondary', onClick: onClose, autofocus: true },
        ...(rows.length > 0 ? [{ label: 'Reset stats', variant: 'danger', onClick: onReset }] : []),
      ]}
    >
      {rows.length > 0 ? (
        <div className="stats__scroll">
          <table className="stats">
            <thead>
              <tr>
                <th scope="col">Player</th>
                <th scope="col">Wins</th>
                <th scope="col">Games</th>
                <th scope="col">Busts</th>
                <th scope="col">Best turn</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.name}>
                  <th scope="row">{row.name}</th>
                  <td>{row.wins}</td>
                  <td>{row.games}</td>
                  <td>{row.rolls > 0 ? `${Math.round((row.busts / row.rolls) * 100)}%` : '–'}</td>
                  <td>{row.bestTurn}</td>
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
