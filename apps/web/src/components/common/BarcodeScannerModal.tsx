import 'use client';

import { BrowserMultiFormatReader, IScannerControls } from '@zxing/browser';
import { BarcodeFormat, DecodeHintType, EncodeHintType } from '@zxing/library';
import type { Result, Exception } from '@zxing/library';
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
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    const startScanner = async () => {
      const video = videoRef.current;
      if (!video) return;

      try {
        const constraints: MediaStreamConstraints = {
          video: {
            facingMode: { ideal: 'environment' },
            width: { ideal: 1280 },
            height: { ideal: 720 },
            // bazı tarayıcılarda odak/zoom ipuçları
            // @ts-expect-error advanced may not exist on types
            advanced: [{ focusMode: 'continuous', zoom: 2 }],
          },
          audio: false,
        };

        const stream = await navigator.mediaDevices.getUserMedia(constraints);
        streamRef.current = stream;
        video.srcObject = stream;
        video.playsInline = true;
        video.muted = true;
        await video.play();

        // 1) Öncelik: Native BarcodeDetector (Safari/iOS destekliyorsa çok hızlı)
        const hasNativeDetector =
          typeof window !== 'undefined' &&
          'BarcodeDetector' in window &&
          typeof (window as any).BarcodeDetector?.getSupportedFormats === 'function';

        if (hasNativeDetector) {
          const supported = await (window as any).BarcodeDetector.getSupportedFormats?.();
          const wanted = [
            'ean_13',
            'ean_8',
            'code_128',
            'code_39',
            'code_93',
            'itf',
            'codabar',
            'upc_a',
            'upc_e',
            'data_matrix',
            'qr_code',
          ];
          const formats = supported?.filter((f: string) => wanted.includes(f.toLowerCase()));
          if (formats && formats.length > 0) {
            const detector = new (window as any).BarcodeDetector({ formats });
            let running = true;

            const detectLoop = async () => {
              if (!running || !videoRef.current) return;
              try {
                const codes = await detector.detect(videoRef.current);
                if (codes && codes.length > 0) {
                  onScan(codes[0].rawValue);
                  stopScanner();
                  onClose();
                  return;
                }
              } catch {
                // frame decode hatası normal, yoksay
              }
              requestAnimationFrame(detectLoop);
            };

            requestAnimationFrame(detectLoop);
            return; // native yol kullanılıyor
          }
        }

        // 2) ZXing fallback (TRY_HARDER, geniş format listesi)
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
          BarcodeFormat.QR_CODE,
        ]);
        hints.set(DecodeHintType.TRY_HARDER, true);
        hints.set(EncodeHintType.CHARACTER_SET, 'UTF-8');

        const devices = await BrowserMultiFormatReader.listVideoInputDevices();
        const backDevice = devices.find((d) =>
          d.label.toLowerCase().includes('back') || d.label.toLowerCase().includes('arka'),
        );

        const reader = new BrowserMultiFormatReader(hints);
        const controls = await reader.decodeFromVideoDevice(
          backDevice?.deviceId ?? undefined,
          video,
          (result?: Result | null, err?: Exception | undefined) => {
            if (result) {
              onScan(result.getText());
              stopScanner();
              onClose();
              return;
            }
            // kare bazlı hata normal, sessiz geç
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
      streamRef.current?.getTracks().forEach((t) => t.stop());
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
