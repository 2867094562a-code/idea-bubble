/**
 * Vercel Functions reject request and non-streaming response payloads above
 * 4.5 MB. Keep application JSON below that platform boundary so callers get
 * a useful product error instead of a platform-generated 413 response.
 */
export const MAX_FUNCTION_PAYLOAD_BYTES = 4_250_000;

/** A 3 MiB binary expands to roughly 4 MiB when encoded as base64. */
export const MAX_ANALYZABLE_IMAGE_BYTES = 3 * 1024 * 1024;

/** Includes the base64 data and its short `data:image/...;base64,` prefix. */
export const MAX_INLINE_DATA_URL_CHARS = 4_200_000;

export function utf8ByteLength(value: string): number {
  return new TextEncoder().encode(value).byteLength;
}
