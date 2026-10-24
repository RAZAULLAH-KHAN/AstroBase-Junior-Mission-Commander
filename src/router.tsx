import { createBrowserRouter } from 'react-router-dom';
import { SiteLayout } from './ui/components/SiteLayout';
import { AboutPage } from './ui/pages/About';
import { DebriefPage } from './ui/pages/Debrief';
import { LandingPage } from './ui/pages/Landing';
import { LibraryPage } from './ui/pages/Library';
import { NotFoundPage } from './ui/pages/NotFound';
import { PlayPage } from './ui/pages/Play';
import { SetupPage } from './ui/pages/Setup';
import { TeacherPage } from './ui/pages/Teacher';

export const router = createBrowserRouter([
  { path: '/play', element: <PlayPage /> },
  {
    element: <SiteLayout />,
    children: [
      { path: '/', element: <LandingPage /> },
      { path: '/setup', element: <SetupPage /> },
      { path: '/debrief', element: <DebriefPage /> },
      { path: '/library', element: <LibraryPage /> },
      { path: '/teacher', element: <TeacherPage /> },
      { path: '/about', element: <AboutPage /> },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
]);
