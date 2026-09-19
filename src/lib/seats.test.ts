import { seatDisplayName } from './seats';

describe('seatDisplayName', () => {
  it('STR は UTG、6max の MP は HJ と表示する', () => {
    const six = ['SB', 'BB', 'STR', 'MP', 'CO', 'BTN'] as const;
    expect(seatDisplayName('STR', six)).toBe('UTG');
    expect(seatDisplayName('MP', six)).toBe('HJ');
    expect(seatDisplayName('CO', six)).toBe('CO');
  });

  it('9max で HJ があるときは MP を HJ にしない', () => {
    const nine = ['SB', 'BB', 'UTG', 'MP', 'LJ', 'HJ', 'CO', 'BTN'] as const;
    expect(seatDisplayName('MP', nine)).toBe('MP');
    expect(seatDisplayName('HJ', nine)).toBe('HJ');
  });
});
