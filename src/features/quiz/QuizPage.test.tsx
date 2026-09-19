import { fireEvent, render, screen } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { appRoutes } from '../../appRoutes';
import { DEFAULT_META, DEFAULT_SETTINGS } from '../../store/schema';
import { usePersistNoticeStore } from '../../store/notice';
import { useSettingsStore } from '../../store/settings';
import { useStatsStore } from '../../store/stats';

function resetStores(): void {
  localStorage.clear();
  usePersistNoticeStore.setState({ message: null });
  useSettingsStore.setState({ ...DEFAULT_SETTINGS, questionCount: 10 });
  useStatsStore.setState({ sessions: [], meta: DEFAULT_META });
}

function renderAt(path: string) {
  const router = createMemoryRouter(appRoutes, { initialEntries: [path] });
  return render(<RouterProvider router={router} />);
}

function typeNumber(value: string): void {
  for (const ch of value) {
    fireEvent.click(screen.getByTestId(`key-${ch}`));
  }
  fireEvent.click(screen.getByTestId('key-submit'));
}

function answerCurrentQuestion(): void {
  let guard = 0;
  while (screen.queryByTestId('feedback') === null) {
    guard += 1;
    if (guard > 50) {
      throw new Error('question did not finish');
    }
    const phase = screen.getByTestId('quiz-phase').textContent;
    if (phase === 'reveal') {
      throw new Error('reveal should auto-advance');
    }
    const answer = screen.getByTestId('quiz-answer').textContent ?? '';
    typeNumber(answer);
  }
}

function playTen(path: string): void {
  renderAt(path);
  for (let i = 0; i < 10; i++) {
    answerCurrentQuestion();
    fireEvent.click(screen.getByTestId('next-question'));
  }
  expect(screen.getByTestId('result-accuracy')).toHaveTextContent('100%');
}

describe('Phase 3 quiz modes', () => {
  beforeEach(() => {
    resetStores();
  });

  it('ホームの副モード C/E と主CTAが活性化している', () => {
    renderAt('/');
    expect(screen.getByTestId('home-max-raise')).toHaveAttribute(
      'href',
      '/quiz/max-raise',
    );
    expect(screen.getByTestId('home-chips')).toHaveAttribute('href', '/quiz/chips');
    expect(screen.getByTestId('home-sim')).toHaveAttribute('href', '/quiz/sim');
    expect(screen.getByTestId('home-triple')).toHaveAttribute('href', '/quiz/triple');
    expect(screen.queryByTestId('home-pot-count')).not.toBeInTheDocument();
    expect(screen.queryByTestId('home-side-pot')).not.toBeInTheDocument();
  });

  it('モード C を 10 問完走できる', () => {
    playTen('/quiz/chips');
  }, 20_000);

  it('モード A を 10 問完走できる', () => {
    playTen('/quiz/max-raise');
  }, 20_000);

  it('モード A はディーラー視点でアクションを進める', () => {
    renderAt('/quiz/max-raise');
    expect(screen.getByTestId('poker-table')).toBeInTheDocument();
    expect(screen.getByTestId('dealer-button')).toBeInTheDocument();
    expect(screen.getByTestId('action-log')).toBeInTheDocument();
    expect(screen.queryByTestId('reveal-next')).not.toBeInTheDocument();
  });

  it('モード E を 10 問完走できる', () => {
    playTen('/quiz/sim');
  }, 20_000);

  it('3倍ドリルを 10 問完走できる', () => {
    playTen('/quiz/triple');
  }, 20_000);
});
