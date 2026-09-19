import { Outlet } from 'react-router-dom';
import { strings } from './lib/strings';
import { usePersistNoticeStore } from './store/notice';

function PersistBanner() {
  const message = usePersistNoticeStore((s) => s.message);
  const dismiss = usePersistNoticeStore((s) => s.dismiss);
  if (!message) return null;
  return (
    <div className="mx-4 mt-3 border border-caution p-3 text-sm">
      <p>{message}</p>
      <button
        type="button"
        className="mt-2 min-h-11 text-ink"
        onClick={dismiss}
      >
        {strings.persist.dismiss}
      </button>
    </div>
  );
}

export function AppShell() {
  return (
    <div className="flex h-dvh justify-center overflow-hidden bg-white text-ink">
      <div className="flex h-full w-full max-w-[375px] flex-col overflow-hidden">
        <PersistBanner />
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
          <Outlet />
        </div>
      </div>
    </div>
  );
}
