import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { LearnPage } from './LearnPage';
import { strings } from '../../lib/strings';

describe('LearnPage', () => {
  it('数値を変えると最大レイズ額が変わる', () => {
    render(
      <MemoryRouter>
        <LearnPage />
      </MemoryRouter>,
    );
    const before = screen.getByText(new RegExp(`${strings.learn.result}:`)).textContent;
    const plusButtons = screen.getAllByRole('button', { name: '＋' });
    const raisePlus = plusButtons[0];
    expect(raisePlus).toBeDefined();
    if (!raisePlus) return;
    fireEvent.click(raisePlus);
    const after = screen.getByText(new RegExp(`${strings.learn.result}:`)).textContent;
    expect(after).not.toBe(before);
  });
});
