import { Link } from 'react-router-dom';
import { strings } from '../../lib/strings';

export function PageHeader({ title }: { title: string }) {
  return (
    <header className="flex items-center gap-3 px-4 py-3 border-b border-stroke">
      <Link
        to="/"
        className="inline-flex min-h-11 min-w-11 items-center justify-center text-muted"
      >
        {strings.common.back}
      </Link>
      <h1 className="text-base font-medium">{title}</h1>
    </header>
  );
}
