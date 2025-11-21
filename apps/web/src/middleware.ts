import { authMiddleware } from '@clerk/nextjs';
import { NextResponse } from 'next/server';

const isClerkConfigured = Boolean(process.env.CLERK_SECRET_KEY);

export default isClerkConfigured
  ? authMiddleware({
      publicRoutes: ['/login', '/manifest.json', '/'],
    })
  : () => NextResponse.next();

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|manifest.json).*)'],
};
