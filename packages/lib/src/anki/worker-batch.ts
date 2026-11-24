export const WORKER_BATCH_MAGIC = "PNOB";
export const WORKER_BATCH_VERSION = 1;
export const MAX_WORKER_BATCH_FILES = 40;
export const MAX_WORKER_BATCH_BYTES = 2_500_000;

export interface WorkerBatchFileInput {
  name: string;
  contentType: string;
  bytes: Uint8Array;
}

const textEncoder = new TextEncoder();

export function detectAnkiMediaContentType(filename: string): string {
  const ext = filename.toLowerCase().split(".").pop() ?? "";
  switch (ext) {
    case "mp3":
      return "audio/mpeg";
    case "wav":
      return "audio/wav";
    case "m4a":
      return "audio/mp4";
    case "ogg":
      return "audio/ogg";
    case "webm":
      return "audio/webm";
    case "mp4":
      return "video/mp4";
    case "png":
      return "image/png";
    case "jpg":
    case "jpeg":
      return "image/jpeg";
    case "webp":
      return "image/webp";
    case "gif":
      return "image/gif";
    case "svg":
      return "image/svg+xml";
    default:
      return "application/octet-stream";
  }
}

/**
 * Encodes a batch of media files + HMAC upload token into a compact PNOB v1 binary frame:
 * [4B "PNOB"][1B version=1][2B tokenLen][token][2B fileCount]
 * per file: [2B nameLen][name][2B ctLen][contentType][4B dataLen][raw bytes]
 */
export function packWorkerMediaBatch(
  token: string,
  files: WorkerBatchFileInput[],
): Uint8Array {
  if (files.length === 0 || files.length > MAX_WORKER_BATCH_FILES) {
    throw new Error(
      `Worker batch file count must be between 1 and ${MAX_WORKER_BATCH_FILES}`,
    );
  }

  const tokenBytes = textEncoder.encode(token);
  const encodedEntries = files.map((file) => {
    const nameBytes = textEncoder.encode(file.name);
    const ctBytes = textEncoder.encode(
      file.contentType || detectAnkiMediaContentType(file.name),
    );
    return { nameBytes, ctBytes, dataBytes: file.bytes };
  });

  let totalLen = 4 + 1 + 2 + tokenBytes.byteLength + 2;
  for (const entry of encodedEntries) {
    totalLen +=
      2 +
      entry.nameBytes.byteLength +
      2 +
      entry.ctBytes.byteLength +
      4 +
      entry.dataBytes.byteLength;
  }

  const out = new Uint8Array(totalLen);
  const view = new DataView(out.buffer);
  let offset = 0;

  // Magic "PNOB" + version 1
  out[offset++] = 0x50;
  out[offset++] = 0x4e;
  out[offset++] = 0x4f;
  out[offset++] = 0x42;
  out[offset++] = WORKER_BATCH_VERSION;

  view.setUint16(offset, tokenBytes.byteLength, false);
  offset += 2;
  out.set(tokenBytes, offset);
  offset += tokenBytes.byteLength;

  view.setUint16(offset, encodedEntries.length, false);
  offset += 2;

  for (const entry of encodedEntries) {
    view.setUint16(offset, entry.nameBytes.byteLength, false);
    offset += 2;
    out.set(entry.nameBytes, offset);
    offset += entry.nameBytes.byteLength;

    view.setUint16(offset, entry.ctBytes.byteLength, false);
    offset += 2;
    out.set(entry.ctBytes, offset);
    offset += entry.ctBytes.byteLength;

    view.setUint32(offset, entry.dataBytes.byteLength, false);
    offset += 4;
    out.set(entry.dataBytes, offset);
    offset += entry.dataBytes.byteLength;
  }

  return out;
}
