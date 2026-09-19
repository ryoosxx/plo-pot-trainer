import { render, screen } from '@testing-library/react';
import type { Seat } from '../../domain/types';
import { PokerTable } from './PokerTable';

function seat(
  id: Seat['id'],
  opts: Partial<Pick<Seat, 'folded' | 'isHero' | 'isButton'>> = {},
): Seat {
  return {
    id,
    label: id,
    stack: 200,
    folded: opts.folded ?? false,
    isHero: opts.isHero ?? false,
    isButton: opts.isButton ?? id === 'BTN',
  };
}

describe('PokerTable', () => {
  const seats = [
    seat('SB'),
    seat('BB'),
    seat('UTG', { isHero: true }),
    seat('MP'),
    seat('CO'),
    seat('BTN'),
  ];

  it('ディーラー視点で投入額と D ボタンを出す', () => {
    render(
      <PokerTable
        seats={seats}
        contributions={{ SB: 100, BB: 200 }}
        heroSeat="UTG"
      />,
    );
    expect(screen.getByTestId('poker-table')).toBeInTheDocument();
    expect(screen.getByTestId('table-amount-SB')).toHaveTextContent('100');
    expect(screen.getByTestId('table-amount-BB')).toHaveTextContent('200');
    expect(screen.getByTestId('dealer-button')).toBeInTheDocument();
    expect(screen.getByTestId('table-seat-UTG')).toHaveAttribute('data-hero', 'true');
    expect(screen.getByTestId('table-seat-UTG')).toHaveAttribute('data-label', 'UTG');
    expect(screen.getByTestId('table-seat-UTG')).toHaveTextContent('HERO (UTG)');
    expect(screen.getByTestId('table-stack-UTG')).toHaveTextContent('200');
    expect(screen.getByTestId('table-stack-SB')).toHaveTextContent('100');
  });

  it('STR は UTG、MP は HJ と表示する', () => {
    render(
      <PokerTable
        seats={[
          seat('SB'),
          seat('BB'),
          seat('STR', { isHero: true }),
          seat('MP'),
          seat('CO'),
          seat('BTN'),
        ]}
        contributions={{ STR: 4, MP: 4 }}
        heroSeat="STR"
      />,
    );
    expect(screen.getByTestId('table-seat-STR')).toHaveTextContent('HERO (UTG)');
    expect(screen.getByTestId('table-seat-MP')).toHaveTextContent('HJ');
  });
});
