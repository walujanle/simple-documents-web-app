type RuntimeEnv = Record<string, unknown> | undefined;

const readEnv = (runtimeEnv: RuntimeEnv, key: string): string => {
  const runtimeValue = runtimeEnv?.[key];
  if (typeof runtimeValue === 'string') return runtimeValue;

  const metaEnv =
    typeof import.meta !== 'undefined' && (import.meta as any).env
      ? ((import.meta as any).env[key] as string | undefined)
      : undefined;
  const procEnv = typeof process !== 'undefined' ? process.env?.[key] : undefined;
  return procEnv || metaEnv || '';
};

const parseOrigins = (value: string): string[] => {
  return value
    .split(/[\s,]+/)
    .map((origin) => origin.trim().replace(/[\r\n;]/g, ''))
    .filter(Boolean);
};

const unique = (values: string[]): string[] => [...new Set(values)];

export const buildContentSecurityPolicy = (runtimeEnv?: RuntimeEnv): string => {
  const scriptOrigins = parseOrigins(readEnv(runtimeEnv, 'CSP_SCRIPT_ORIGINS'));
  const connectOrigins = parseOrigins(readEnv(runtimeEnv, 'CSP_CONNECT_ORIGINS'));

  const directives = [
    ['default-src', ["'self'"]],
    ['base-uri', ["'self'"]],
    ['object-src', ["'none'"]],
    ['frame-ancestors', ["'none'"]],
    ['form-action', ["'self'"]],
    ['script-src', ["'self'", "'unsafe-inline'", ...scriptOrigins]],
    ['style-src', ["'self'", "'unsafe-inline'"]],
    ['font-src', ["'self'", 'data:']],
    ['img-src', ["'self'", 'data:', 'blob:', 'https:', 'http:']],
    ['media-src', ["'self'", 'data:', 'blob:', 'https:', 'http:']],
    ['connect-src', ["'self'", ...connectOrigins]],
    ['worker-src', ["'self'", 'blob:']],
    ['frame-src', ["'self'"]],
  ];

  return directives
    .map(([name, values]) => `${name} ${unique(values as string[]).join(' ')}`)
    .join('; ');
};
