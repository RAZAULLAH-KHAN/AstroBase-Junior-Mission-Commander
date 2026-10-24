import { useEffect } from 'react';
import { RouterProvider } from 'react-router-dom';
import { router } from './router';
import { useGameStore } from './store/gameStore';
import { useTheme } from './ui/hooks/useTheme';

export function App() {
  const largeText = useGameStore((s) => s.settings.largeText);
  const { theme } = useTheme();

  useEffect(() => {
    document.documentElement.classList.toggle('large-text', largeText);
  }, [largeText]);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document
      .querySelector('meta[name="theme-color"]')
      ?.setAttribute('content', theme === 'dark' ? '#0B1020' : '#F1F4FA');
  }, [theme]);

  return <RouterProvider router={router} />;
}
