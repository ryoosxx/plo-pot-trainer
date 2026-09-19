import { Navigate } from 'react-router-dom';
import { AppShell } from './layout';
import { HomePage } from './features/home/HomePage';
import { SettingsPage } from './features/settings/SettingsPage';
import { StatsPage } from './features/stats/StatsPage';
import { LearnPage } from './features/rules/LearnPage';
import { QuizPage, ResultPage } from './features/quiz';

export const appRoutes = [
  {
    element: <AppShell />,
    children: [
      { path: '/', element: <HomePage /> },
      { path: '/settings', element: <SettingsPage /> },
      { path: '/stats', element: <StatsPage /> },
      { path: '/learn', element: <LearnPage /> },
      { path: '/quiz/:mode', element: <QuizPage /> },
      { path: '/result/:sessionId', element: <ResultPage /> },
      { path: '*', element: <Navigate to="/" replace /> },
    ],
  },
];
