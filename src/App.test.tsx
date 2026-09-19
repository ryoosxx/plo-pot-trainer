import { render, screen } from '@testing-library/react';
import { RouterProvider, createMemoryRouter } from 'react-router-dom';
import { appRoutes } from './appRoutes';

function renderAt(path: string) {
  const router = createMemoryRouter(appRoutes, { initialEntries: [path] });
  return render(<RouterProvider router={router} />);
}

describe('App', () => {
  it('タイトルを表示する', () => {
    renderAt('/');
    expect(
      screen.getByRole('heading', { name: 'PLO Pot Trainer' }),
    ).toBeInTheDocument();
    expect(screen.getByTestId('home-stats').getAttribute('href')).toContain(
      '/stats',
    );
  });

  it('統計画面を開く', () => {
    renderAt('/stats');
    expect(screen.getByRole('heading', { name: '統計' })).toBeInTheDocument();
  });
});
