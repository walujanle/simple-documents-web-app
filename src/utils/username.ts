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

export const isValidUsername = (username: string): boolean =>
  /^[a-z0-9][a-z0-9-]{1,30}[a-z0-9]$/.test(normalizeUsername(username));

export const getUsernameValidationError = (username: string): string | null => {
  const cleanUsername = normalizeUsername(username);
  if (cleanUsername.length < 3) return 'Username must be at least 3 characters.';
  if (!isValidUsername(cleanUsername)) {
    return 'Username must use 3-32 lowercase letters, numbers, or dashes, and cannot start or end with a dash.';
  }
  if (isReservedUsername(cleanUsername)) return 'This username is reserved.';
  return null;
};

export const MIN_PASSWORD_LENGTH = 10;
