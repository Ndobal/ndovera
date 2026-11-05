// Pictures get smaller on the person's own device before they upload, so people upload as they always have.
// No AI and no server work. Anything that cannot be shrunk goes up as it was: an upload never fails because of this.

const PROFILES = {
  // Logos and profile pictures are shown small.
  small: { maxSide: 512, targetBytes: 50 * 1024, qualities: [0.86, 0.8, 0.74] },
  // Website pictures, events, news: sharp on a large screen.
  photo: { maxSide: 1600, targetBytes: 200 * 1024, qualities: [0.84, 0.78, 0.72, 0.66] },
  // Work, notes and records must stay readable, so these may stay larger.
  document: { maxSide: 2000, targetBytes: 500 * 1024, qualities: [0.85, 0.8, 0.75] },
};

const SHRINKABLE = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/bmp'];

/** What kind of picture an upload address takes. Null leaves it untouched. */
export function kindForUpload(path = '') {
  const text = String(path).toLowerCase();
  if (/face/.test(text)) return null; // Staff attendance compares faces, so keep every detail.
  if (/logo|avatar/.test(text)) return 'small';
  if (/website|section|event|news|flier|gallery|showcase/.test(text)) return 'photo';
  return 'document';
}

const blobOf = (canvas, type, quality) => new Promise((resolve, reject) => {
  if (!canvas.toBlob) { reject(new Error('no toBlob')); return; }
  canvas.toBlob(blob => (blob ? resolve(blob) : reject(new Error('no blob'))), type, quality);
});

function loadPicture(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => resolve({ image, done: () => URL.revokeObjectURL(url) });
    image.onerror = () => { URL.revokeObjectURL(url); reject(new Error('not a readable picture')); };
    image.src = url;
  });
}

/** A transparent background has to stay PNG. A logo with none can be a much smaller JPEG. */
function hasTransparency(context, width, height) {
  const step = Math.max(1, Math.floor(Math.max(width, height) / 200));
  const { data } = context.getImageData(0, 0, width, height);
  for (let y = 0; y < height; y += step) {
    for (let x = 0; x < width; x += step) {
      if (data[(y * width + x) * 4 + 3] < 250) return true;
    }
  }
  return false;
}

function renameTo(name, extension) {
  const base = String(name || 'picture').replace(/\.[^./\\]+$/, '');
  return `${base}.${extension}`;
}

function draw(image, scale, background) {
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
  canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
  const context = canvas.getContext('2d');
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = 'high';
  if (background) { context.fillStyle = background; context.fillRect(0, 0, canvas.width, canvas.height); }
  context.drawImage(image, 0, 0, canvas.width, canvas.height);
  return { canvas, context };
}

/**
 * The picture at a sensible size. Stops at the highest quality that reaches the target. If none does, it keeps the
 * lowest quality that still looks good, even though that is over the target: a good picture matters more than the number.
 */
export async function shrinkImage(file, kind = 'photo') {
  const profile = PROFILES[kind];
  if (!profile || !file || !SHRINKABLE.includes(String(file.type).toLowerCase()) || file.size <= profile.targetBytes) return file;
  try {
    const { image, done } = await loadPicture(file);
    try {
      const longest = Math.max(image.naturalWidth, image.naturalHeight);
      if (!longest) return file;
      const scale = Math.min(1, profile.maxSide / longest);
      const first = draw(image, scale);
      let blob;
      let type = 'image/jpeg';
      if (file.type !== 'image/jpeg' && hasTransparency(first.context, first.canvas.width, first.canvas.height)) {
        type = 'image/png';
        blob = await blobOf(first.canvas, type);
      } else {
        const { canvas } = draw(image, scale, '#ffffff');
        for (const quality of profile.qualities) {
          blob = await blobOf(canvas, type, quality); // eslint-disable-line no-await-in-loop
          if (blob.size <= profile.targetBytes) break;
        }
      }
      if (!blob || blob.size >= file.size) return file;
      return new File([blob], renameTo(file.name, type === 'image/png' ? 'png' : 'jpg'), { type, lastModified: Date.now() });
    } finally {
      done();
    }
  } catch {
    return file;
  }
}

/** For the code that sends uploads: the file, shrunk to suit the address it is going to. */
export function shrinkForUpload(file, path) {
  const kind = kindForUpload(path);
  return kind ? shrinkImage(file, kind) : Promise.resolve(file);
}
