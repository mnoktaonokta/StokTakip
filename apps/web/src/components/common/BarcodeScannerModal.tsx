import 'use client';

import {
  BrowserMultiFormatReader,
  IScannerControls,
} from '@zxing/browser';
import { BarcodeFormat, DecodeHintType } from '@zxing/library';
import { X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

interface BarcodeScannerModalProps {
  onScan: (result: string) => void;
  onClose: () => void;
}

export function BarcodeScannerModal({ onScan, onClose }: BarcodeScannerModalProps) {
  const [error, setError] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const controlsRef = useRef<IScannerControls | null>(null);

  useEffect(() => {
    const startScanner = async () => {
      if (!videoRef.current) return;

      try {
        const hints = new Map();
        hints.set(DecodeHintType.POSSIBLE_FORMATS, [
          BarcodeFormat.EAN_13,
          BarcodeFormat.EAN_8,
          BarcodeFormat.CODE_128,
          BarcodeFormat.CODE_39,
          BarcodeFormat.CODE_93,
          BarcodeFormat.ITF,
          BarcodeFormat.CODABAR,
          BarcodeFormat.UPC_A,
          BarcodeFormat.UPC_E,
          BarcodeFormat.DATA_MATRIX,
        ]);

        const reader = new BrowserMultiFormatReader(hints);
        const devices = await BrowserMultiFormatReader.listVideoInputDevices();
        const backDevice = devices.find((d) =>
          d.label.toLowerCase().includes('back') || d.label.toLowerCase().includes('arka'),
        );

        const controls = await reader.decodeFromVideoDevice(
          backDevice?.deviceId ?? undefined,
          videoRef.current,
          (result, err) => {
            if (result) {
              onScan(result.getText());
              stopScanner();
              onClose();
            }
            // kare bazlı decode hatalarını yoksay
          },
        );

        controlsRef.current = controls;
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
      controlsRef.current?.stop();
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
          <video
            ref={videoRef}
            className="w-full max-w-md overflow-hidden rounded-lg bg-black object-contain"
            muted
            playsInline
            autoPlay
          />
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
