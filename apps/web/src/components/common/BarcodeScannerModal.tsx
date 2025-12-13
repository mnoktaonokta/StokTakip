'use client';

import { Html5Qrcode, Html5QrcodeSupportedFormats, Html5QrcodeScanType } from 'html5-qrcode';
import { X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

interface BarcodeScannerModalProps {
  onScan: (result: string) => void;
  onClose: () => void;
}

export function BarcodeScannerModal({ onScan, onClose }: BarcodeScannerModalProps) {
  const [error, setError] = useState<string | null>(null);
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const regionId = 'reader-container'; // HTML element ID for the scanner

  useEffect(() => {
    // Component mount olduğunda scanner'ı başlat
    const startScanner = async () => {
      try {
        const scanner = new Html5Qrcode(regionId);
        scannerRef.current = scanner;

        const qrboxWidth = Math.min(window.innerWidth - 40, 420);
        const config = {
          fps: 20, // hızlı tarama denemesi
          qrbox: { width: qrboxWidth, height: 140 }, // 1D barkod için daha yatay alan
          // aspectRatio verilmedi; kamera doğal oranını kullanacak
          disableFlip: false, // bazı cihazlarda mirroring açıkken daha iyi okuyabiliyor
          videoConstraints: {
            facingMode: { ideal: 'environment' },
            width: { ideal: 1920 },
            height: { ideal: 1080 },
          },
          rememberLastUsedCamera: true,
          supportedScanTypes: [Html5QrcodeScanType.SCAN_TYPE_CAMERA],
          formatsToSupport: [
            Html5QrcodeSupportedFormats.EAN_13,
            Html5QrcodeSupportedFormats.EAN_8,
            Html5QrcodeSupportedFormats.CODE_128,
            Html5QrcodeSupportedFormats.CODE_39,
            Html5QrcodeSupportedFormats.CODE_93,
            Html5QrcodeSupportedFormats.CODABAR,
            Html5QrcodeSupportedFormats.ITF,
            Html5QrcodeSupportedFormats.UPC_A,
            Html5QrcodeSupportedFormats.UPC_E,
            Html5QrcodeSupportedFormats.DATA_MATRIX, // karekod
          ],
          experimentalFeatures: {
            useBarCodeDetectorIfSupported: true,
          },
        };

        // Arka kamerayı ("environment") tercih et
        // Mümkünse arka kameranın deviceId'sini seç
        const cameras = await Html5Qrcode.getCameras().catch(() => []);
        const backCamera = Array.isArray(cameras)
          ? cameras.find((c) => c.label.toLowerCase().includes('back') || c.label.toLowerCase().includes('arka'))
          : undefined;

        await scanner.start(
          backCamera ? { deviceId: backCamera.id } : { facingMode: { ideal: 'environment' } },
          config,
          (decodedText) => {
            onScan(decodedText);
            stopScanner();
            onClose();
          },
          () => {
            // kare bazlı decode hatalarını yoksay
          },
        );
      } catch (err) {
        console.error('Kamera başlatılamadı:', err);
        setError('Kamera başlatılamadı. İzinleri kontrol edin.');
      }
    };

    // DOM hazır olunca başlat
    const timer = setTimeout(() => {
        startScanner();
    }, 100);

    return () => {
      clearTimeout(timer);
      stopScanner();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const stopScanner = () => {
    if (scannerRef.current && scannerRef.current.isScanning) {
      scannerRef.current
        .stop()
        .then(() => {
          scannerRef.current?.clear();
        })
        .catch((err) => console.error('Scanner durdurma hatası:', err));
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
           <div id={regionId} className="w-full max-w-md overflow-hidden rounded-lg bg-black"></div>
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
