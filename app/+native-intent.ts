export function redirectSystemPath({
  path,
}: {
  path: string;
  initial: boolean;
}) {
  try {
    const url = new URL(path);

    if (url.hostname === 'spotzapp.app' && url.pathname.startsWith('/spot/')) {
      return url.pathname;
    }

    if (url.protocol === 'spotz:' && url.hostname === 'spot') {
      return `/spot/${url.pathname.replace(/^\/+/, '')}`;
    }

    if (url.protocol === 'spotz:' && url.pathname.startsWith('/spot/')) {
      return url.pathname;
    }
  } catch {
    if (path.startsWith('/spot/')) {
      return path;
    }
  }

  return path;
}
