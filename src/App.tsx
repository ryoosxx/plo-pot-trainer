import { useState } from 'react';
import { RouterProvider, createBrowserRouter } from 'react-router-dom';
import { appRoutes } from './appRoutes';

export default function App() {
  const [router] = useState(() => {
    const raw = import.meta.env.BASE_URL;
    const basename = raw === '/' || raw === '' ? '/' : raw.replace(/\/$/, '');
    return createBrowserRouter(appRoutes, { basename });
  });
  return <RouterProvider router={router} />;
}
