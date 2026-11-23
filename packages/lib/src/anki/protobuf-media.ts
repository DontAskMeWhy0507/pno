function readVarintSafe(bytes: Uint8Array, state: { pos: number }): number {
  let result = 0;
  let multiplier = 1;
  let count = 0;
  while (state.pos < bytes.length && count < 10) {
    const b = bytes[state.pos++]!;
    if (count < 7) {
      result += (b & 0x7f) * multiplier;
      multiplier *= 128;
    }
    count++;
    if ((b & 0x80) === 0) return result;
  }
  throw new Error("Malformed varint in Anki protobuf data");
}

function skipProtobufField(
  bytes: Uint8Array,
  state: { pos: number },
  wireType: number,
  limit: number,
): void {
  if (wireType === 0) {
    readVarintSafe(bytes, state);
  } else if (wireType === 1) {
    state.pos = Math.min(limit, state.pos + 8);
  } else if (wireType === 2) {
    const len = readVarintSafe(bytes, state);
    if (len < 0 || state.pos + len > limit) {
      throw new Error("Truncated length-delimited field in Anki protobuf");
    }
    state.pos += len;
  } else if (wireType === 5) {
    state.pos = Math.min(limit, state.pos + 4);
  } else {
    throw new Error(`Unsupported protobuf wire type ${wireType}`);
  }
}

export function decodeProtobufMedia(
  bytes: Uint8Array,
): Record<string, string> {
  const map: Record<string, string> = {};
  const state = { pos: 0 };
  let entryIndex = 0;

  while (state.pos < bytes.length) {
    const tag = readVarintSafe(bytes, state);
    const fieldNum = tag >> 3;
    const wireType = tag & 0x07;

    if (fieldNum === 1 && wireType === 2) {
      const entryLen = readVarintSafe(bytes, state);
      if (entryLen < 0 || state.pos + entryLen > bytes.length) break;
      const endPos = state.pos + entryLen;
      let filename = "";

      while (state.pos < endPos) {
        const innerTag = readVarintSafe(bytes, state);
        const innerField = innerTag >> 3;
        const innerWire = innerTag & 0x07;

        if (innerField === 1 && innerWire === 2) {
          const fnLen = readVarintSafe(bytes, state);
          if (fnLen < 0 || state.pos + fnLen > endPos) break;
          filename = new TextDecoder().decode(
            bytes.slice(state.pos, state.pos + fnLen),
          );
          state.pos += fnLen;
        } else {
          skipProtobufField(bytes, state, innerWire, endPos);
        }
      }

      state.pos = endPos;
      if (filename) {
        map[String(entryIndex)] = filename;
      }
      entryIndex++;
    } else {
      skipProtobufField(bytes, state, wireType, bytes.length);
    }
  }

  return map;
}
