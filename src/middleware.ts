import { defineMiddleware } from 'astro:middleware';
import { isWeakJwtSecret, verifyJWT } from '@/utils/auth';
import { config } from '@/utils/config';

export const onRequest = defineMiddleware(async (context, next) => {
  const { url, cookies, redirect, request } = context;
  const path = url.pathname;

  // Retrieve session token from cookie
  const sessionToken = cookies.get('session')?.value;
  let user: { id: string; username: string } | null = null;

  if (sessionToken) {
    const payload = await verifyJWT(sessionToken, config.jwtSecret);
    if (payload) {
      user = { id: payload.id, username: payload.username };
      context.locals.user = user;
    } else {
      // Clear invalid session cookie
      cookies.delete('session', { path: '/' });
    }
  }

  // Route security checks
  const isDocumentsRoute = path.startsWith('/documents');
  const isAPIDocumentsRoute = path.startsWith('/api/documents');
  const isAPIFoldersRoute = path.startsWith('/api/folders');
  const isAPIImagesRoute = path.startsWith('/api/images');
  const isAPIAuthRoute = path.startsWith('/api/auth');
  const isAuthPageRoute = path === '/login' || path === '/register';
  const isProtectedRoute =
    isDocumentsRoute || isAPIDocumentsRoute || isAPIFoldersRoute || isAPIImagesRoute;
  const isApiRoute = path.startsWith('/api/');
  const isUnsafeMethod = !['GET', 'HEAD', 'OPTIONS'].includes(request.method.toUpperCase());
  const isCrossSiteMutation = (): boolean => {
    const origin = request.headers.get('Origin');
    if (origin) return origin !== url.origin;
    return request.headers.get('Sec-Fetch-Site') === 'cross-site';
  };
  const applyAppHeaders = (response: Response): Response => {
    if (isProtectedRoute || isAuthPageRoute || isApiRoute) {
      response.headers.set('Cache-Control', 'private, no-store, no-transform');
      response.headers.set('Vary', 'Cookie');
    }
    response.headers.set('X-Content-Type-Options', 'nosniff');
    response.headers.set('X-Frame-Options', 'DENY');
    response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
    response.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
    if (config.isProd) {
      response.headers.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
    }
    return response;
  };
  const jsonResponse = (body: unknown, status: number): Response =>
    applyAppHeaders(
      new Response(JSON.stringify(body), {
        status,
        headers: { 'Content-Type': 'application/json' },
      }),
    );

  // Redirect old dashboard requests to documents
  if (path.startsWith('/dashboard')) {
    return redirect('/documents');
  }

  if ((isProtectedRoute || isAPIAuthRoute) && config.isProd && isWeakJwtSecret(config.jwtSecret)) {
    return jsonResponse({ error: 'JWT_SECRET must be configured before production use.' }, 500);
  }

  if ((isProtectedRoute || isAPIAuthRoute) && isUnsafeMethod && isCrossSiteMutation()) {
    return jsonResponse({ error: 'Forbidden' }, 403);
  }

  if (isProtectedRoute && !user) {
    if (isAPIDocumentsRoute || isAPIFoldersRoute || isAPIImagesRoute) {
      return jsonResponse({ error: 'Unauthorized' }, 401);
    }
    return redirect('/login');
  }

  if (isAuthPageRoute && user) {
    return redirect('/documents');
  }

  const response = await next();
  if (config.isProd && isApiRoute && response.status >= 500) {
    return jsonResponse({ error: 'Internal Server Error' }, response.status);
  }

  return applyAppHeaders(response);
});
