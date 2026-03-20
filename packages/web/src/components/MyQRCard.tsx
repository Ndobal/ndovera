import React, { useEffect, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { Download, QrCode } from 'lucide-react';
import { fetchWithAuth } from '../services/apiClient';
import { loadUser } from '../services/authLocal';

export default function MyQRCard() {
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const user = loadUser();

  useEffect(() => {
    const fetchToken = async () => {
      try {
        const data = await fetchWithAuth('/api/qr/my-token');
        if (data.token) {
          setToken(data.token);
        } else {
          setError('No QR Code has been generated for your profile yet. Please contact the ICT Manager or HoS.');
        }
      } catch (err: any) {
        setError('Failed to fetch QR Code. ' + err.message);
      } finally {
        setLoading(false);
      }
    };
    fetchToken();
  }, []);

  const handleDownload = () => {
    const svg = document.getElementById('my-qr-code');
    if (!svg) return;
    const svgData = new XMLSerializer().serializeToString(svg);
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const img = new Image();
    img.onload = () => {
      canvas.width = img.width;
      canvas.height = img.height;
      if (ctx) {
        // add white background
        ctx.fillStyle = 'white';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0);
        const a = document.createElement('a');
        a.download = `NDovera-ID-${user?.name?.replace(/\s+/g, '-') || 'Card'}.png`;
        a.href = canvas.toDataURL('image/png');
        a.click();
      }
    };
    img.src = 'data:image/svg+xml;base64,' + btoa(svgData);
  };

  return (
    <div className="max-w-md mx-auto p-6 bg-slate-800/50 border border-slate-700/50 rounded-2xl flex flex-col items-center shadow-xl">
      <div className="w-full flex items-center justify-between mb-8">
        <h2 className="text-xl font-bold text-white flex items-center gap-2">
          <QrCode size={24} className="text-emerald-400" /> My Attendance ID
        </h2>
      </div>

      {loading ? (
        <p className="text-slate-400 py-12">Loading your secure token...</p>
      ) : error ? (
        <div className="text-amber-400 bg-amber-500/10 p-4 rounded-lg text-center text-sm">
          {error}
        </div>
      ) : (
        <div className="flex flex-col items-center w-full">
          <div className="bg-white p-6 rounded-2xl shadow-inner mb-6 relative">
            <QRCodeSVG
              id="my-qr-code"
              value={token!}
              size={240}
              level="H"
              includeMargin={true}
              imageSettings={{
                src: '/logo.png',
                x: undefined,
                y: undefined,
                height: 48,
                width: 48,
                excavate: true,
              }}
            />
          </div>
          
          <div className="text-center mb-6">
            <p className="text-lg font-bold text-white">{user?.name}</p>
            <p className="text-sm font-mono text-emerald-400 mt-1">{user?.role}</p>
          </div>

          <button 
            onClick={handleDownload}
            className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-bold shadow-lg shadow-emerald-900/20 transition-all flex items-center justify-center gap-2"
          >
            <Download size={18} /> Save Image to Phone
          </button>
          
          <p className="text-xs text-slate-500 text-center mt-6">
            Present this code to the security scanner at the arrival gate.<br />
            Do not share this code.
          </p>
        </div>
      )}
    </div>
  );
}