'use client';

import { BrowserMultiFormatReader, IScannerControls } from '@zxing/browser';
import { useEffect, useRef, useState } from 'react';

interface Props {
  onDetected: (value: string) => void;
}

export function BarcodeScanner({ onDetected }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const controlsRef = useRef<IScannerControls | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const reader = new BrowserMultiFormatReader();

    const startScanner = async () => {
      if (!videoRef.current) return;
      try {
        const controls = await reader.decodeFromVideoDevice(
          undefined,
          videoRef.current,
          (result) => {
            if (result) {
              onDetected(result.getText());
            }
          },
        );
        controlsRef.current = controls;
        setReady(true);
      } catch (error) {
        console.error('Barkod başlatma hatası', error);
        setReady(false);
      }
    };

    startScanner();

    return () => {
      controlsRef.current?.stop();
      reader.reset();
    };
  }, [onDetected]);

  return (
    <div className="space-y-2">
      <video ref={videoRef} className="h-64 w-full rounded-2xl border border-slate-800 bg-black object-cover" />
      <p className="text-center text-xs text-slate-400">
        {ready ? 'Kamera aktif - barkodu okutabilirsiniz' : 'Kamera başlatılıyor...'}
      </p>
    </div>
  );
}
