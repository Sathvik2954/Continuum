/**
 * Compresses an image file client-side to under the target size before upload.
 * Uses canvas resizing + JPEG quality reduction - runs entirely in-browser.
 */
export async function compressImage(
  file: File,
  maxSizeKb = 300,
  maxDimension = 1600
): Promise<Blob> {
  const img = await loadImage(file);

  let { width, height } = img;
  if (width > maxDimension || height > maxDimension) {
    const scale = maxDimension / Math.max(width, height);
    width = Math.round(width * scale);
    height = Math.round(height * scale);
  }

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas context unavailable');
  ctx.drawImage(img, 0, 0, width, height);

  // Try decreasing quality until under target size
  let quality = 0.85;
  let blob = await canvasToBlob(canvas, quality);

  while (blob.size / 1024 > maxSizeKb && quality > 0.3) {
    quality -= 0.1;
    blob = await canvasToBlob(canvas, quality);
  }

  return blob;
}

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
    img.onerror = reject;
    img.src = url;
  });
}

function canvasToBlob(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('Compression failed'))),
      'image/jpeg',
      quality
    );
  });
}
