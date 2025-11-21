import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Dental İmplant Stok Takip',
    short_name: 'StokTakip',
    description: 'Dental implant stok, transfer, lot ve fatura yönetimi',
    start_url: '/',
    display: 'standalone',
    background_color: '#020617',
    theme_color: '#0891b2',
    icons: [
      {
        src: '/favicon.ico',
        sizes: 'any',
        type: 'image/x-icon',
      },
    ],
  };
}
