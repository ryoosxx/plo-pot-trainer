import { useState } from 'react';
import { RouterProvider, createHashRouter } from 'react-router-dom';
import { appRoutes } from './appRoutes';

export default function App() {
  const [router] = useState(() => createHashRouter(appRoutes));
  return <RouterProvider router={router} />;
}
