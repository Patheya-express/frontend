import { IMAGE_UPLOAD_LIMITS } from '@patheya-express-frontend/ui';

/**
 * Pickup-photo rules — ProofController uses the backend's IMAGE_* upload limits, mirrored once in
 * the shared IMAGE_UPLOAD_LIMITS. The backend stays authoritative; these only let the app explain
 * a problem before uploading.
 */
export const PICKUP_PHOTO_ACCEPTED_TYPES = IMAGE_UPLOAD_LIMITS.mimeTypes;
export const PICKUP_PHOTO_MAX_BYTES = IMAGE_UPLOAD_LIMITS.maxBytes;
export const PICKUP_PHOTO_LIMITS_HINT = IMAGE_UPLOAD_LIMITS.hint;

/** Longest edge a downscaled photo is resized to — ample for a parcel reference photo. */
const DOWNSCALE_MAX_EDGE_PX = 1600;
const DOWNSCALE_JPEG_QUALITY = 0.8;

/** Returns a user-facing problem with the file's type, or null when it is acceptable. Size is
 *  handled separately by `preparePickupPhoto`, which can often fix an oversized camera photo. */
export function pickupPhotoTypeError(file: File): string | null {
  return PICKUP_PHOTO_ACCEPTED_TYPES.includes(file.type)
    ? null
    : 'Please choose a JPG, PNG or WebP photo.';
}

export function pickupPhotoSizeError(file: File): string | null {
  return file.size <= PICKUP_PHOTO_MAX_BYTES
    ? null
    : 'This photo is larger than 5 MB. Retake it, or choose a smaller photo.';
}

/**
 * Modern phone cameras routinely produce photos above the 5 MB server limit, which previously
 * failed only after a full upload attempt. Oversized photos are re-encoded as a JPEG with the
 * longest edge capped at 1600px (`imageOrientation: 'from-image'` keeps EXIF rotation). Files
 * already within the limit are returned untouched. If the browser/WebView lacks the APIs, or
 * decoding fails, the original file is returned and `pickupPhotoSizeError` reports it.
 */
export async function preparePickupPhoto(file: File): Promise<File> {
  if (
    file.size <= PICKUP_PHOTO_MAX_BYTES ||
    typeof createImageBitmap !== 'function'
  ) {
    return file;
  }

  try {
    const bitmap = await createImageBitmap(file, {
      imageOrientation: 'from-image',
    });
    const scale = Math.min(
      1,
      DOWNSCALE_MAX_EDGE_PX / Math.max(bitmap.width, bitmap.height),
    );
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);

    const context = canvas.getContext('2d');
    if (!context) {
      bitmap.close();
      return file;
    }

    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, 'image/jpeg', DOWNSCALE_JPEG_QUALITY),
    );
    if (!blob) {
      return file;
    }

    const name = file.name.replace(/\.[^.]+$/, '') || 'parcel';
    return new File([blob], `${name}.jpg`, {
      type: 'image/jpeg',
      lastModified: Date.now(),
    });
  } catch {
    return file;
  }
}
