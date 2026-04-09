function stripLeadingSlashes(value: string): string {
  return value.replace(/^\/+/, '');
}

function stripTrailingSlashes(value: string): string {
  return value.replace(/\/+$/, '');
}

export function normalizeBasePath(rawBase: string): string {
  const trimmed = stripTrailingSlashes(rawBase);
  return trimmed === '' ? '/' : trimmed;
}

export function getBasePath(): string {
  return normalizeBasePath(import.meta.env.BASE_URL ?? '/');
}

export function getRouterBasename(): string {
  return getBasePath();
}

export function joinBasePath(basePath: string, pathname: string): string {
  const normalizedPath = stripLeadingSlashes(pathname);

  if (normalizedPath === '') {
    return basePath;
  }

  if (basePath === '/') {
    return `/${normalizedPath}`;
  }

  return `${basePath}/${normalizedPath}`;
}

export function toAppPath(pathname: string): string {
  return joinBasePath(getBasePath(), pathname);
}

export function toAbsoluteAppUrl(pathname: string): string {
  return new URL(toAppPath(pathname), window.location.origin).toString();
}
