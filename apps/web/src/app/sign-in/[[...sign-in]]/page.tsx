// src/app/sign-in/[[...sign-in]]/page.tsx
import { SignIn } from '@clerk/nextjs';

export default function SignInPage() {
  // Ortam değişkeni kontrolü
  const hasClerk = Boolean(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY);

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-950 px-4 py-10">
      <div className="w-full max-w-md rounded-3xl border border-slate-800 bg-slate-900/60 p-6 text-white">
        <h1 className="text-2xl font-semibold mb-2">Stok Takip Girişi</h1>
        <p className="text-sm text-slate-400 mb-6">Devam etmek için giriş yapın.</p>

        <div className="flex justify-center">
          {hasClerk ? (
            /* routing="hash" sildik, varsayılan path routing kullanacak */
            <SignIn />
          ) : (
            <div className="space-y-3 text-sm text-slate-300">
              <p>
                Demo modundasınız. <code className="rounded bg-slate-800 px-2 py-1">x-user-role</code> header ile rol seçerek
                backend API&apos;sine istek gönderebilirsiniz.
              </p>
              <p>Clerk anahtarlarını .env dosyasına girerek gerçek oturumları aktif edin.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}