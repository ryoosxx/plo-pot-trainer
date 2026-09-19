import { browserPathToHashUrl } from './spaHash';

describe('browserPathToHashUrl', () => {
  it('Pages の /stats をハッシュへ寄せる', () => {
    expect(
      browserPathToHashUrl(
        '/plo-pot-trainer/stats',
        '',
        '',
        '/plo-pot-trainer/',
      ),
    ).toBe('/plo-pot-trainer/#/stats');
  });

  it('ホームや既にハッシュがある場合は何もしない', () => {
    expect(
      browserPathToHashUrl('/plo-pot-trainer/', '', '', '/plo-pot-trainer/'),
    ).toBeNull();
    expect(
      browserPathToHashUrl(
        '/plo-pot-trainer/',
        '',
        '#/stats',
        '/plo-pot-trainer/',
      ),
    ).toBeNull();
  });
});
