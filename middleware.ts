import { NextResponse, type NextRequest } from 'next/server';

// A deployed copy holds an API key that can publish to your channels. Set APP_PASSWORD and the whole app (pages and
// API routes) asks for it with HTTP basic auth; any username works.
export function middleware(req: NextRequest) {
  const password = process.env.APP_PASSWORD;
  if (!password) return NextResponse.next();
  const header = req.headers.get('authorization') || '';
  if (header.startsWith('Basic ')) {
    try {
      const decoded = atob(header.slice(6));
      const given = decoded.slice(decoded.indexOf(':') + 1);
      if (given === password) return NextResponse.next();
    } catch {
      /* fall through to the challenge */
    }
  }
  return new NextResponse('Password required', {
    status: 401,
    headers: { 'WWW-Authenticate': 'Basic realm="Social Scheduler", charset="UTF-8"' },
  });
}

export const config = { matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'] };
