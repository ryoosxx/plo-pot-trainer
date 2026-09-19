import { useEffect, useRef } from 'react';

export function ActionLog({ items }: { items: readonly string[] }) {
  const ref = useRef<HTMLUListElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [items]);

  if (items.length === 0) {
    return (
      <ul
        data-testid="action-log"
        className="h-full min-h-0 overflow-y-auto py-1 text-center text-sm tabular-nums text-muted"
      />
    );
  }
  return (
    <ul
      ref={ref}
      data-testid="action-log"
      className="h-full min-h-0 space-y-0.5 overflow-y-auto overscroll-y-contain py-1 text-center text-sm tabular-nums"
    >
      {items.map((item, index) => {
        const latest = index === items.length - 1;
        return (
          <li
            key={`${index}-${item}`}
            className={latest ? 'text-ink' : 'text-muted'}
          >
            {item}
          </li>
        );
      })}
    </ul>
  );
}
