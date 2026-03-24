import React, { useEffect, useRef, useState } from 'react';
import { Html5QrcodeScanner, Html5QrcodeSupportedFormats } from 'html5-qrcode';
import { fetchWithAuth } from '../services/apiClient';

interface Props {
  roleScanned: 'staff' | 'student';
  onScanSuccess?: (msg: string) => void;
  onScanError?: (msg: string) => void;
}

export default function QRScanner({ roleScanned, onScanSuccess, onScanError }: Props) {
  const [scanningMessage, setScanningMessage] = useState<string>('Initializing Scanner...');
  const [success, setSuccess] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const scannerRef = useRef<Html5QrcodeScanner | null>(null);

  useEffect(() => {
    // Only initialize scanner if not already done
    if (!scannerRef.current) {
      scannerRef.current = new Html5QrcodeScanner(
        "qr-reader",
        { 
          fps: 10, 
          qrbox: { width: 250, height: 250 },
          aspectRatio: 1.0,
          formatsToSupport: [ Html5QrcodeSupportedFormats.QR_CODE ]
        },
        // verbose
        false
      );

      scannerRef.current.render(onScan, onScanFailure);
      setScanningMessage('Point camera at student/staff QR code');
    }

    return () => {
      if (scannerRef.current) {
        scannerRef.current.clear().catch(e => console.error("Failed to clear scanner", e));
        scannerRef.current = null;
      }
    };
  }, []);

  const onScan = async (decodedText: string) => {
    // Pause scanning to prevent multiple scans of the same code quickly
    if (scannerRef.current) {
      scannerRef.current.pause(true);
    }
    setScanningMessage('Processing scan...');
    setSuccess(null);
    setError(null);

    try {
      const response = await fetchWithAuth('/api/attendance/scan', {
        method: 'POST',
        body: JSON.stringify({ qr_token: decodedText, override_role: roleScanned }),
      });
      
      setSuccess(`✅ Marked ${response.user?.name || 'User'} as Present`);
      if (onScanSuccess) onScanSuccess(`Marked ${response.user?.name} as Present`);
    } catch (err: any) {
      setError(`❌ Scan Failed: ${err.message}`);
      if (onScanError) onScanError(err.message);
    } finally {
      // Resume scanning after 2.5 seconds
      setTimeout(() => {
        setScanningMessage('Ready for next scan');
        setSuccess(null);
        setError(null);
        if (scannerRef.current) {
          scannerRef.current.resume();
        }
      }, 2500);
    }
  };

  const onScanFailure = (error: any) => {
    // Ignore constant scan failures when no QR code is found
    // console.warn(`Code scan error = ${error}`);
  };

  return (
    <div className="w-full flex flex-col items-center justify-center p-4">
      {success && (
        <div className="w-full max-w-sm mb-4 p-4 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-xl text-center font-bold animate-pulse">
          {success}
        </div>
      )}
      {error && (
        <div className="w-full max-w-sm mb-4 p-4 bg-rose-500/10 text-rose-400 border border-rose-500/20 rounded-xl text-center font-bold">
          {error}
        </div>
      )}
      
      <div className="w-full max-w-md bg-white p-4 rounded-xl shadow-inner border-4 border-slate-200 dark:border-slate-700">
        <div id="qr-reader" className="w-full overflow-hidden rounded-lg bg-black text-black"></div>
      </div>
      
      <p className="mt-4 text-slate-500 dark:text-slate-400 font-medium text-center">
        {scanningMessage}
      </p>
    </div>
  );
}