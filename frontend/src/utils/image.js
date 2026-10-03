const MAX_FILE_BYTES = 10 * 1024 * 1024;

/**
 * Center-crops an image file to a square and scales it to `size`×`size`,
 * returning a small JPEG data URL (typically 15–40 KB) ready to send to the API.
 */
export async function resizeImageToDataUrl(file, size = 256) {
  if (!file.type.startsWith('image/')) throw new Error('Please choose an image file.');
  if (file.size > MAX_FILE_BYTES) throw new Error('That image is over 10 MB. Please choose a smaller one.');

  const objectUrl = URL.createObjectURL(file);
  try {
    const image = await new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error('Could not read that image. Try a PNG or JPEG.'));
      img.src = objectUrl;
    });

    const side = Math.min(image.naturalWidth, image.naturalHeight);
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const context = canvas.getContext('2d');
    context.fillStyle = '#fff'; // transparent PNGs become white, not black, as JPEG
    context.fillRect(0, 0, size, size);
    context.drawImage(
      image,
      (image.naturalWidth - side) / 2,
      (image.naturalHeight - side) / 2,
      side,
      side,
      0,
      0,
      size,
      size,
    );
    return canvas.toDataURL('image/jpeg', 0.85);
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}
