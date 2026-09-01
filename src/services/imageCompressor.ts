/**
 * Compresses an image file or blob to a manageable size (JPEG, max 1280px)
 * to allow storing hundreds of inspection photos in IndexedDB without lag.
 */
export async function compressImage(
  file: File | Blob,
  maxWidth = 1280,
  maxHeight = 1280,
  quality = 0.82,
  addTimestamp = true
): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (readerEvent) => {
      const img = new Image();
      img.onload = () => {
        let width = img.width;
        let height = img.height;

        // Calculate new dimensions maintaining aspect ratio
        if (width > height) {
          if (width > maxWidth) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          }
        } else {
          if (height > maxHeight) {
            width = Math.round((width * maxHeight) / height);
            height = maxHeight;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Canvas context not available'));
          return;
        }

        // Draw the image
        ctx.drawImage(img, 0, 0, width, height);

        // Optional timestamp watermark for legal authenticity
        if (addTimestamp) {
          const now = new Date();
          const dateStr = now.toLocaleDateString('pt-BR');
          const timeStr = now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
          const watermarkText = `VistoriaPro • ${dateStr} ${timeStr}`;

          const fontSize = Math.max(12, Math.round(width * 0.022));
          ctx.font = `600 ${fontSize}px Inter, sans-serif`;

          const paddingX = 12;
          const paddingY = 6;
          const textMetrics = ctx.measureText(watermarkText);
          const bgWidth = textMetrics.width + paddingX * 2;
          const bgHeight = fontSize + paddingY * 2;
          const posX = width - bgWidth - 14;
          const posY = height - bgHeight - 14;

          // Draw semi-transparent dark pill background
          ctx.fillStyle = 'rgba(15, 23, 42, 0.75)';
          ctx.beginPath();
          ctx.roundRect(posX, posY, bgWidth, bgHeight, 6);
          ctx.fill();

          // Draw white text
          ctx.fillStyle = '#ffffff';
          ctx.textBaseline = 'middle';
          ctx.fillText(watermarkText, posX + paddingX, posY + bgHeight / 2);
        }

        const compressedDataUrl = canvas.toDataURL('image/jpeg', quality);
        resolve(compressedDataUrl);
      };

      img.onerror = (err) => reject(err);
      if (typeof readerEvent.target?.result === 'string') {
        img.src = readerEvent.target.result;
      } else {
        reject(new Error('Failed to read image file'));
      }
    };

    reader.onerror = (err) => reject(err);
    reader.readAsDataURL(file);
  });
}
