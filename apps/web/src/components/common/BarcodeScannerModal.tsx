import 'use client';

import { X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import type { QuaggaJSResultObject } from '@ericblade/quagga2';
import dynamic from 'next/dynamic';

interface BarcodeScannerModalProps {
  onScan: (result: string) => void;
  onClose: () => void;
}

export function BarcodeScannerModal({ onScan, onClose }: BarcodeScannerModalProps) {
  const [error, setError] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const quaggaRef = useRef<any>(null);

  useEffect(() => {
    const startScanner = async () => {
      if (!containerRef.current) return;

      try {
        const Quagga = (await import('@ericblade/quagga2')).default;
        quaggaRef.current = Quagga;

        await Quagga.init(
          {
            inputStream: {
              name: 'Live',
              type: 'LiveStream',
              target: containerRef.current,
              constraints: {
                facingMode: 'environment',
                width: { ideal: 1280 },
                height: { ideal: 720 },
              },
            },
            locator: {
              patchSize: 'medium',
              halfSample: true,
            },
            decoder: {
              readers: [
                'ean_reader',
                'ean_8_reader',
                'code_128_reader',
                'code_39_reader',
                'code_93_reader',
                'i2of5_reader',
                'codabar_reader',
                'upc_reader',
                'upc_e_reader',
              ],
            },
            locate: true,
            numOfWorkers: navigator.hardwareConcurrency ? Math.max(1, navigator.hardwareConcurrency - 1) : 2,
          },
          (err: Error | null) => {
            if (err) {
              console.error(err);
              setError('Kamera başlatılamadı. İzinleri kontrol edin.');
              return;
            }
            Quagga.start();
          },
        );

        Quagga.onDetected((data: QuaggaJSResultObject) => {
          const code = data.codeResult?.code;
          if (code) {
            onScan(code);
            stopScanner();
            onClose();
          }
        });
      } catch (err) {
        console.error('Kamera başlatılamadı:', err);
        setError('Kamera başlatılamadı. İzinleri kontrol edin.');
      }
    };

    const timer = setTimeout(() => {
      startScanner();
    }, 150);

    return () => {
      clearTimeout(timer);
      stopScanner();
    };
  }, [onClose, onScan]);

  const stopScanner = () => {
    try {
      if (quaggaRef.current) {
        quaggaRef.current.offDetected();
        quaggaRef.current.stop();
        quaggaRef.current = null;
      }
    } catch (err) {
      console.error('Scanner durdurma hatası:', err);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black">
      {/* Header */}
      <div className="flex items-center justify-between bg-slate-900 p-4 safe-area-top">
        <h2 className="text-lg font-semibold text-white">Barkod Tara</h2>
        <button
          onClick={() => {
            stopScanner();
            onClose();
          }}
          className="rounded-full bg-slate-800 p-2 text-white hover:bg-slate-700"
        >
          <X className="size-6" />
        </button>
      </div>

      {/* Camera View */}
      <div className="relative flex-1 bg-black overflow-hidden flex flex-col items-center justify-center">
        {error ? (
          <div className="p-6 text-center text-red-400">
            <p className="mb-2 text-xl font-bold">Hata</p>
            <p>{error}</p>
            <button
              onClick={onClose}
              className="mt-6 rounded-lg bg-slate-800 px-6 py-2 text-white"
            >
              Kapat
            </button>
          </div>
        ) : (
          <div ref={containerRef} className="w-full max-w-md overflow-hidden rounded-lg bg-black" />
        )}
        
        {!error && (
            <p className="mt-4 text-sm text-slate-400 px-4 text-center">
                Barkodu yeşil çerçevenin içine hizalayın
            </p>
        )}
      </div>
      
      <style jsx>{`
        .safe-area-top {
            padding-top: env(safe-area-inset-top, 20px);
        }
        /* html5-qrcode kütüphanesinin gereksiz butonlarını gizle */
        #html5-qrcode-button-camera-stop, 
        #html5-qrcode-anchor-scan-type-change {
            display: none !important;
        }
      `}</style>
    </div>
  );
}
