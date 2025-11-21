import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server';

// Sadece giriş sayfası (ve api/public rotaları) herkese açık olsun.
// Sign-up sayfasını buraya EKLEMİYORUZ, böylece oraya erişim kilitli kalır.
const isPublicRoute = createRouteMatcher([
  '/sign-in(.*)',
  '/api/public(.*)'
]);

export default clerkMiddleware(async (auth, req) => {
  // Eğer gidilmek istenen sayfa "public" değilse, koruma altına al
  if (!isPublicRoute(req)) {
    await auth.protect();
  }
});

export const config = {
  matcher: [
    // Next.js statik dosyaları ve resimler hariç her şeyi yakala
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    // API rotalarını her zaman yakala
    '/(api|trpc)(.*)',
  ],
};
