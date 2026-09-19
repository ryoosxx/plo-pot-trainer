import { resultFeedback, tapFeedback } from './feedback';

describe('feedback', () => {
  it('vibrate / AudioContext がなくても投げない', () => {
    expect(() => tapFeedback(true)).not.toThrow();
    expect(() => tapFeedback(false)).not.toThrow();
    expect(() => resultFeedback(true, true, true)).not.toThrow();
    expect(() => resultFeedback(false, true, true)).not.toThrow();
    expect(() => resultFeedback(true, false, false)).not.toThrow();
  });
});
