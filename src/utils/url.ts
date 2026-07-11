import { config } from '@/utils/config';

const trimTrailingSlash = (value: string): string => value.replace(/\/+$/, '');

export const getAppBaseUrl = (): string => {
  const configured = trimTrailingSlash(config.appBaseUrl.trim());
  return configured;
};

export const absoluteAppUrl = (path = '/'): string => {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return new URL(normalizedPath, `${getAppBaseUrl()}/`).toString();
};
