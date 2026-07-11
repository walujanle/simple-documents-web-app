import { config } from '@/utils/config';

/** Generic client-safe API error body. Never forward raw exception messages. */
export const apiErrorResponse = (
  status: number,
  publicMessage = 'Internal Server Error',
): Response =>
  new Response(JSON.stringify({ error: publicMessage }), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

export const apiErrorFromCaught = (
  error: unknown,
  fallback = 'Internal Server Error',
): Response => {
  if (config.isProd) return apiErrorResponse(500, fallback);
  const message = error instanceof Error ? error.message : fallback;
  return apiErrorResponse(500, message || fallback);
};
