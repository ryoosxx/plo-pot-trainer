/**
 * GitHub Pages は /stats などを 404.html で返す。
 * HashRouter へ寄せて、統計などの直リンクを開けるようにする。
 */
export function browserPathToHashUrl(
  pathname: string,
  search: string,
  hash: string,
  baseUrl: string,
): string | null {
  if (hash.length > 1) return null;
  const base = baseUrl === '/' || baseUrl === '' ? '' : baseUrl.replace(/\/$/, '');
  if (base !== '' && !pathname.startsWith(base)) return null;
  const rest = base === '' ? pathname : pathname.slice(base.length);
  const path = rest === '' ? '/' : rest;
  if (path === '/' || path === '') return null;
  const suffix = path.startsWith('/') ? path : `/${path}`;
  return `${base}/${search}#${suffix}`;
}
