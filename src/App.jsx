import { I18nProvider } from './shared/i18n/index.jsx';
import { Casino } from './casino/Casino.jsx';
import { RewardsProvider } from './casino/useRewards.jsx';

/**
 * The whole app: language (English / Persian, LTR / RTL) → stars & stats → the
 * game hall. Sound is provided one level up (see main.jsx).
 */
export default function App() {
  return (
    <I18nProvider>
      <RewardsProvider>
        <Casino />
      </RewardsProvider>
    </I18nProvider>
  );
}
