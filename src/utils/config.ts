const getEnv = (key: string, defaultValue = ''): string => {
  const metaEnv = import.meta.env?.[key];
  const procEnv = typeof process !== 'undefined' ? process.env?.[key] : undefined;
  return metaEnv || procEnv || defaultValue;
};

const defaultAppName = 'Simple Documents';
const defaultAppBaseUrl = 'http://localhost:4321';
const defaultFooterPoweredByLabel = 'Powered by';
const defaultFooterCopyright = (year: number, appName: string) =>
  `${year} ${appName}. Built with Astro & React.`;

export const config = {
  databaseUrl: getEnv('DATABASE_URL'),
  jwtSecret: getEnv('JWT_SECRET', 'super-secret-key-change-me'),
  allowRegistration: getEnv('ALLOW_REGISTRATION', 'true') === 'true',
  nodeEnv: getEnv('NODE_ENV', 'development'),
  isProd: getEnv('NODE_ENV') === 'production',
  coverImage: getEnv('APP_COVER_IMAGE', '/cover/cover-placeholder.png'),
  appName: getEnv('APP_NAME', defaultAppName),
  appBaseUrl: getEnv('APP_BASE_URL', defaultAppBaseUrl),
  appDescription: getEnv('APP_DESCRIPTION', 'Simple document management web app'),
  appLogo: getEnv('APP_LOGO', ''),
  appIcon: getEnv('APP_ICON', '/favicon.svg'),
  footerPoweredByLabel: defaultFooterPoweredByLabel,
  footerCopyright: defaultFooterCopyright,
  versionRetentionDays: Math.max(1, parseInt(getEnv('VERSION_RETENTION_DAYS', '7'), 10) || 7),
};
