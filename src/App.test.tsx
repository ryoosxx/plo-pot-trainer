import { render, screen } from '@testing-library/react';
import App from './App';

describe('App', () => {
  beforeEach(() => {
    window.history.pushState({}, '', '/');
  });

  it('タイトルを表示する', () => {
    render(<App />);
    expect(
      screen.getByRole('heading', { name: 'PLO Pot Trainer' }),
    ).toBeInTheDocument();
  });
});
