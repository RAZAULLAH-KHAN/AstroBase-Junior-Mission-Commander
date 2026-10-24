import { useGameStore } from '../../store/gameStore';
import { useMediaQuery } from './useMediaQuery';

export type Theme = 'dark' | 'light';

/** The theme in effect: the player's choice, or the system preference until they choose. */
export function useTheme(): { theme: Theme; toggle: () => void } {
  const preference = useGameStore((s) => s.settings.theme);
  const update = useGameStore((s) => s.updateSettings);
  const systemLight = useMediaQuery('(prefers-color-scheme: light)');
  const theme: Theme = preference === 'system' ? (systemLight ? 'light' : 'dark') : preference;
  return { theme, toggle: () => update({ theme: theme === 'dark' ? 'light' : 'dark' }) };
}
