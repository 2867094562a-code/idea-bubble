export type DecodedImageType = "png" | "jpg" | "gif";

export interface DecodedImage {
  data: Buffer;
  type: DecodedImageType;
  mimeType: string;
  width: number;
  height: number;
}

const MAX_EMBEDDED_IMAGE_BYTES = 20 * 1024 * 1024;

function pngDimensions(data: Buffer): { width: number; height: number } | undefined {
  if (data.length < 24 || data.toString("ascii", 1, 4) !== "PNG") return undefined;
  return { width: data.readUInt32BE(16), height: data.readUInt32BE(20) };
}

function gifDimensions(data: Buffer): { width: number; height: number } | undefined {
  if (data.length < 10 || !data.toString("ascii", 0, 6).startsWith("GIF8")) return undefined;
  return { width: data.readUInt16LE(6), height: data.readUInt16LE(8) };
}

function jpegDimensions(data: Buffer): { width: number; height: number } | undefined {
  if (data.length < 4 || data[0] !== 0xff || data[1] !== 0xd8) return undefined;
  let offset = 2;
  while (offset + 8 < data.length) {
    if (data[offset] !== 0xff) {
      offset += 1;
      continue;
    }
    const marker = data[offset + 1];
    offset += 2;
    if (marker === 0xd8 || marker === 0xd9) continue;
    if (offset + 2 > data.length) break;
    const length = data.readUInt16BE(offset);
    if (length < 2 || offset + length > data.length) break;
    const isStartOfFrame =
      (marker >= 0xc0 && marker <= 0xc3) ||
      (marker >= 0xc5 && marker <= 0xc7) ||
      (marker >= 0xc9 && marker <= 0xcb) ||
      (marker >= 0xcd && marker <= 0xcf);
    if (isStartOfFrame && length >= 7) {
      return { width: data.readUInt16BE(offset + 5), height: data.readUInt16BE(offset + 3) };
    }
    offset += length;
  }
  return undefined;
}

export function decodeDataUrlImage(dataUrl: string | undefined): DecodedImage | undefined {
  if (!dataUrl) return undefined;
  const match = /^data:(image\/(?:png|jpe?g|gif));base64,([a-z0-9+/=\s]+)$/i.exec(dataUrl);
  if (!match) return undefined;
  const data = Buffer.from(match[2].replace(/\s/g, ""), "base64");
  if (!data.length || data.length > MAX_EMBEDDED_IMAGE_BYTES) return undefined;

  const mimeType = match[1].toLowerCase();
  const type: DecodedImageType = mimeType === "image/png" ? "png" : mimeType === "image/gif" ? "gif" : "jpg";
  const dimensions =
    type === "png" ? pngDimensions(data) : type === "gif" ? gifDimensions(data) : jpegDimensions(data);
  if (!dimensions || dimensions.width <= 0 || dimensions.height <= 0) return undefined;
  return { data, type, mimeType, ...dimensions };
}

export function fitImage(
  width: number,
  height: number,
  maxWidth: number,
  maxHeight: number,
): { width: number; height: number } {
  const scale = Math.min(maxWidth / width, maxHeight / height, 1);
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}
