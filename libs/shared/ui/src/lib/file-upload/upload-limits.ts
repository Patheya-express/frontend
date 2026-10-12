/**
 * Client-side mirror of the backend's upload rules in
 * `apps/api-gateway/src/modules/storage/utils/upload-validation.util.ts` (IMAGE_* / DOCUMENT_*).
 * The backend stays authoritative; these let a form explain a problem before uploading and show
 * the real limits up front. Keep the two files in sync.
 */
export interface UploadLimits {
  /** MIME types, also usable as an `<input type="file" accept>` value via `accept`. */
  readonly mimeTypes: readonly string[];
  readonly accept: string;
  readonly maxBytes: number;
  /** Short, user-facing summary, e.g. "JPG, PNG or WebP · up to 5 MB". */
  readonly hint: string;
  /** Message shown for a file of the wrong type. */
  readonly typeError: string;
  /** Message shown for a file that is too large. */
  readonly sizeError: string;
}

const MB = 1024 * 1024;

function limits(
  mimeTypes: readonly string[],
  maxMb: number,
  formats: string,
): UploadLimits {
  return {
    mimeTypes,
    accept: mimeTypes.join(','),
    maxBytes: maxMb * MB,
    hint: `${formats} · up to ${maxMb} MB`,
    typeError: `Please choose a ${formats} file.`,
    sizeError: `This file is larger than ${maxMb} MB. Choose a smaller file.`,
  };
}

/** IMAGE_MIME_TYPES / IMAGE_MAX_SIZE_BYTES (5 MB). */
export const IMAGE_UPLOAD_LIMITS: UploadLimits = limits(
  ['image/jpeg', 'image/png', 'image/webp'],
  5,
  'JPG, PNG or WebP',
);

/** DOCUMENT_MIME_TYPES / DOCUMENT_MAX_SIZE_BYTES (10 MB). */
export const DOCUMENT_UPLOAD_LIMITS: UploadLimits = limits(
  ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'],
  10,
  'JPG, PNG, WebP or PDF',
);

/** Returns the user-facing problem with `file` under `limits`, or null when it is acceptable. */
export function uploadLimitError(
  file: File,
  uploadLimits: UploadLimits,
): string | null {
  if (!uploadLimits.mimeTypes.includes(file.type)) {
    return uploadLimits.typeError;
  }
  if (file.size > uploadLimits.maxBytes) {
    return uploadLimits.sizeError;
  }
  return null;
}
