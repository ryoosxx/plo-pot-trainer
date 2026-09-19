import type { SessionResult } from '../store/schema';

function escapeCsv(value: string): string {
  if (value.includes('"') || value.includes(',') || value.includes('\n')) {
    return `"${value.replaceAll('"', '""')}"`;
  }
  return value;
}

const HEADER = [
  'sessionId',
  'completed',
  'mode',
  'questionId',
  'seed',
  'level',
  'answer',
  'input',
  'correct',
  'elapsedMs',
  'timedOut',
  'mistake',
  'at',
].join(',');

/**
 * 完了・中断を含む全レコードを CSV にする。
 */
export function sessionsToCsv(sessions: SessionResult[]): string {
  const lines = [HEADER];
  for (const session of sessions) {
    for (const record of session.records) {
      const row = [
        session.id,
        session.completed ? '1' : '0',
        session.mode,
        record.questionId,
        String(record.seed),
        String(record.level),
        String(record.answer),
        String(record.input),
        record.correct ? '1' : '0',
        String(record.elapsedMs),
        record.timedOut ? '1' : '0',
        record.mistake ?? '',
        record.at,
      ].map(escapeCsv);
      lines.push(row.join(','));
    }
  }
  return `${lines.join('\n')}\n`;
}

export function downloadText(filename: string, body: string, mime: string): void {
  const blob = new Blob([body], { type: mime });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
