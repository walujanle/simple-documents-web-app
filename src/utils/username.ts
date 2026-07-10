const reservedUsernames = new Set([
  'api',
  'assets',
  'dashboard',
  'doc',
  'documents',
  'favicon.ico',
  'files',
  'icon',
  'images',
  'login',
  'logo',
  'logout',
  'register',
  'robots.txt',
  'settings',
  'shared',
  'sitemap.xml',
  'static',
]);

export const normalizeUsername = (username: string): string => username.trim().toLowerCase();

export const isReservedUsername = (username: string): boolean =>
  reservedUsernames.has(normalizeUsername(username));
