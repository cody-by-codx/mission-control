import { NextRequest, NextResponse } from 'next/server';

// Log warning at startup if auth is disabled
const MC_API_TOKEN = process.env.MC_API_TOKEN;
if (!MC_API_TOKEN) {
  console.warn('[SECURITY] MC_API_TOKEN not set - API authentication is DISABLED (local dev mode)');
}

// --- Rate limiting (in-memory, per-IP) ---
const RATE_LIMIT = parseInt(process.env.RATE_LIMIT_RPM || '120', 10); // requests per minute
const RATE_WINDOW_MS = 60_000;
const rateLimitStore = new Map<string, { count: number; resetAt: number }>();

function checkRateLimit(ip: string): { allowed: boolean; remaining: number; resetAt: number } {
  const now = Date.now();
  const entry = rateLimitStore.get(ip);

  if (!entry || now > entry.resetAt) {
    rateLimitStore.set(ip, { count: 1, resetAt: now + RATE_WINDOW_MS });
    return { allowed: true, remaining: RATE_LIMIT - 1, resetAt: now + RATE_WINDOW_MS };
  }

  entry.count++;
  const allowed = entry.count <= RATE_LIMIT;
  return { allowed, remaining: Math.max(0, RATE_LIMIT - entry.count), resetAt: entry.resetAt };
}

function getClientIp(request: NextRequest): string {
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) return forwarded.split(',')[0].trim();
  return request.headers.get('x-real-ip') || request.ip || 'unknown';
}

// Periodic cleanup of expired entries (every 2 minutes)
let lastCleanup = Date.now();
function maybeCleanup() {
  const now = Date.now();
  if (now - lastCleanup < 120_000) return;
  lastCleanup = now;
  rateLimitStore.forEach((entry, key) => {
    if (now > entry.resetAt) rateLimitStore.delete(key);
  });
}

/**
 * Check if a request originates from the same host (browser UI).
 */
function isSameOriginRequest(request: NextRequest): boolean {
  const host = request.headers.get('host');
  if (!host) return false;

  const origin = request.headers.get('origin');
  const referer = request.headers.get('referer');

  if (!origin && !referer) return false;

  if (origin) {
    try {
      const originUrl = new URL(origin);
      if (originUrl.host === host) return true;
    } catch {
      // Invalid origin header
    }
  }

  if (referer) {
    try {
      const refererUrl = new URL(referer);
      if (refererUrl.host === host) return true;
    } catch {
      // Invalid referer header
    }
  }

  return false;
}

// Demo mode — read-only, blocks all mutations
const DEMO_MODE = process.env.DEMO_MODE === 'true';
if (DEMO_MODE) {
  console.log('[DEMO] Running in demo mode — all write operations are blocked');
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Only protect /api/* routes
  if (!pathname.startsWith('/api/')) {
    if (DEMO_MODE) {
      const response = NextResponse.next();
      response.headers.set('X-Demo-Mode', 'true');
      return response;
    }
    return NextResponse.next();
  }

  // Skip rate limiting for health checks
  if (pathname === '/api/health') {
    return NextResponse.next();
  }

  // Rate limiting
  maybeCleanup();
  const ip = getClientIp(request);
  const rl = checkRateLimit(ip);

  if (!rl.allowed) {
    const response = NextResponse.json(
      { error: 'Too many requests. Please try again later.' },
      { status: 429 }
    );
    response.headers.set('X-RateLimit-Limit', String(RATE_LIMIT));
    response.headers.set('X-RateLimit-Remaining', '0');
    response.headers.set('X-RateLimit-Reset', String(Math.ceil(rl.resetAt / 1000)));
    response.headers.set('Retry-After', String(Math.ceil((rl.resetAt - Date.now()) / 1000)));
    return response;
  }

  // Demo mode: block all write operations
  if (DEMO_MODE) {
    const method = request.method.toUpperCase();
    if (method !== 'GET' && method !== 'HEAD' && method !== 'OPTIONS') {
      return NextResponse.json(
        { error: 'Demo mode — this is a read-only instance. Visit github.com/crshdn/mission-control to run your own!' },
        { status: 403 }
      );
    }
    const response = NextResponse.next();
    response.headers.set('X-RateLimit-Remaining', String(rl.remaining));
    return response;
  }

  // If MC_API_TOKEN is not set, auth is disabled (dev mode)
  if (!MC_API_TOKEN) {
    const response = NextResponse.next();
    response.headers.set('X-RateLimit-Remaining', String(rl.remaining));
    return response;
  }

  // Allow same-origin browser requests (UI fetching its own API)
  if (isSameOriginRequest(request)) {
    const response = NextResponse.next();
    response.headers.set('X-RateLimit-Remaining', String(rl.remaining));
    return response;
  }

  // Special case: /api/events/stream (SSE) - allow token as query param
  if (pathname === '/api/events/stream') {
    const queryToken = request.nextUrl.searchParams.get('token');
    if (queryToken && queryToken === MC_API_TOKEN) {
      return NextResponse.next();
    }
  }

  // Check Authorization header for bearer token
  const authHeader = request.headers.get('authorization');

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    );
  }

  const token = authHeader.substring(7);

  if (token !== MC_API_TOKEN) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    );
  }

  const response = NextResponse.next();
  response.headers.set('X-RateLimit-Remaining', String(rl.remaining));
  return response;
}

export const config = {
  matcher: ['/api/:path*'],
};
