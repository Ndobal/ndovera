import React, { useState } from 'react';

export default function EventsGalleryPage() {
  const [images, setImages] = useState<string[]>([]);

  const handleUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    files.forEach(file => {
      const reader = new FileReader();
      reader.onload = (ev) => {
        setImages(prev => [...prev, ev.target?.result as string]);
      };
      reader.readAsDataURL(file);
    });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-white to-emerald-100 py-12">
      <div className="max-w-5xl mx-auto">
        <h1 className="text-4xl font-black text-emerald-700 mb-8 text-center">Ndovera Events Gallery</h1>
        <div className="mb-8 flex justify-center">
          <input type="file" accept="image/*" multiple onChange={handleUpload} className="block" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-8">
          {images.length === 0 && <p className="col-span-3 text-center text-slate-500">No event images uploaded yet.</p>}
          {images.map((img, idx) => (
            <div key={idx} className="rounded-2xl overflow-hidden shadow-lg bg-white">
              <img src={img} alt={`Event ${idx + 1}`} className="w-full h-72 object-cover" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
