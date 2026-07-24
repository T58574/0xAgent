import fs from 'node:fs';
import path from 'node:path';

export interface GgufMetadata {
  filePath: string;
  fileName: string;
  fileSizeFormatted: string;
  fileSizeBytes: number;
  magicValid: boolean;
  version: number;
  architecture: string;
  modelName: string;
  quantization: string;
  blockCount: number; // Layer count
  contextLength: number; // Max trained context size (n_ctx_train)
  expertCount: number; // MoE expert count
  isMmproj: boolean; // Vision projector flag
  rawKv: Record<string, any>;
}

enum GgufValueType {
  UINT8 = 0,
  INT8 = 1,
  UINT16 = 2,
  INT16 = 3,
  UINT32 = 4,
  INT32 = 5,
  FLOAT32 = 6,
  BOOL = 7,
  STRING = 8,
  ARRAY = 9,
  UINT64 = 10,
  INT64 = 11,
  FLOAT64 = 12,
}

export function parseGgufMetadata(filePath: string): GgufMetadata {
  const fileName = path.basename(filePath);
  const stats = fs.statSync(filePath);
  const fileSizeBytes = stats.size;
  const fileSizeFormatted = formatBytes(fileSizeBytes);

  // Quick fallback default structure
  const result: GgufMetadata = {
    filePath,
    fileName,
    fileSizeFormatted,
    fileSizeBytes,
    magicValid: false,
    version: 0,
    architecture: 'unknown',
    modelName: fileName.replace(/\.gguf$/i, ''),
    quantization: detectQuantFromFilename(fileName),
    blockCount: 0,
    contextLength: 4096,
    expertCount: 0,
    isMmproj: /mmproj|projector|clip/i.test(fileName),
    rawKv: {},
  };

  let fd: number | null = null;
  try {
    fd = fs.openSync(filePath, 'r');
    // Read first 1.5MB for GGUF metadata header
    const bufferSize = Math.min(1024 * 1024 * 1.5, fileSizeBytes);
    const buffer = Buffer.alloc(bufferSize);
    const bytesRead = fs.readSync(fd, buffer, 0, bufferSize, 0);

    if (bytesRead < 12) {
      return result;
    }

    // Check GGUF magic (0x46554747) -> 'GGUF' ASCII
    const magic = buffer.toString('ascii', 0, 4);
    if (magic !== 'GGUF') {
      return result;
    }

    result.magicValid = true;
    result.version = buffer.readUInt32LE(4);
    const kvCount = Number(buffer.readBigUInt64LE(12));

    let offset = 20;

    for (let i = 0; i < kvCount && offset < bytesRead - 8; i++) {
      try {
        // Read key string length (uint64)
        const keyLen = Number(buffer.readBigUInt64LE(offset));
        offset += 8;
        if (keyLen <= 0 || keyLen > 256 || offset + keyLen >= bytesRead) break;

        const key = buffer.toString('utf-8', offset, offset + keyLen);
        offset += keyLen;

        // Read value type (uint32)
        if (offset + 4 >= bytesRead) break;
        const valType = buffer.readUInt32LE(offset) as GgufValueType;
        offset += 4;

        const { value, newOffset } = parseGgufValue(buffer, offset, valType);
        offset = newOffset;

        result.rawKv[key] = value;
      } catch {
        break; // Stop parsing gracefully on boundary edge
      }
    }

    // Process extracted KV pairs
    if (result.rawKv['general.architecture']) {
      result.architecture = String(result.rawKv['general.architecture']);
    }

    if (result.rawKv['general.name']) {
      result.modelName = String(result.rawKv['general.name']);
    }

    const arch = result.architecture !== 'unknown' ? result.architecture : 'llama';

    // Layer count
    if (result.rawKv[`${arch}.block_count`] !== undefined) {
      result.blockCount = Number(result.rawKv[`${arch}.block_count`]);
    } else if (result.rawKv['llama.block_count'] !== undefined) {
      result.blockCount = Number(result.rawKv['llama.block_count']);
    }

    // Context length
    if (result.rawKv[`${arch}.context_length`] !== undefined) {
      result.contextLength = Number(result.rawKv[`${arch}.context_length`]);
    } else if (result.rawKv['llama.context_length'] !== undefined) {
      result.contextLength = Number(result.rawKv['llama.context_length']);
    }

    // Expert count
    if (result.rawKv[`${arch}.expert_count`] !== undefined) {
      result.expertCount = Number(result.rawKv[`${arch}.expert_count`]);
    }

    // Vision mmproj detection
    if (
      result.rawKv['clip.projector_type'] !== undefined ||
      result.architecture.includes('clip') ||
      /mmproj|projector/i.test(fileName)
    ) {
      result.isMmproj = true;
    }

    // File type quantization enum
    if (result.rawKv['general.file_type'] !== undefined) {
      const fileType = Number(result.rawKv['general.file_type']);
      const parsedQuant = fileTypeToQuantString(fileType);
      if (parsedQuant) result.quantization = parsedQuant;
    }
  } catch (err) {
    console.error(`Error parsing GGUF metadata for ${filePath}:`, err);
  } finally {
    if (fd !== null) {
      try {
        fs.closeSync(fd);
      } catch {}
    }
  }

  return result;
}

function parseGgufValue(buffer: Buffer, offset: number, type: GgufValueType): { value: any; newOffset: number } {
  switch (type) {
    case GgufValueType.UINT8:
      return { value: buffer.readUInt8(offset), newOffset: offset + 1 };
    case GgufValueType.INT8:
      return { value: buffer.readInt8(offset), newOffset: offset + 1 };
    case GgufValueType.UINT16:
      return { value: buffer.readUInt16LE(offset), newOffset: offset + 2 };
    case GgufValueType.INT16:
      return { value: buffer.readInt16LE(offset), newOffset: offset + 2 };
    case GgufValueType.UINT32:
      return { value: buffer.readUInt32LE(offset), newOffset: offset + 4 };
    case GgufValueType.INT32:
      return { value: buffer.readInt32LE(offset), newOffset: offset + 4 };
    case GgufValueType.FLOAT32:
      return { value: buffer.readFloatLE(offset), newOffset: offset + 4 };
    case GgufValueType.BOOL:
      return { value: buffer.readUInt8(offset) !== 0, newOffset: offset + 1 };
    case GgufValueType.STRING: {
      const strLen = Number(buffer.readBigUInt64LE(offset));
      const strVal = buffer.toString('utf-8', offset + 8, offset + 8 + strLen);
      return { value: strVal, newOffset: offset + 8 + strLen };
    }
    case GgufValueType.UINT64:
      return { value: Number(buffer.readBigUInt64LE(offset)), newOffset: offset + 8 };
    case GgufValueType.INT64:
      return { value: Number(buffer.readBigInt64LE(offset)), newOffset: offset + 8 };
    case GgufValueType.FLOAT64:
      return { value: buffer.readDoubleLE(offset), newOffset: offset + 8 };
    case GgufValueType.ARRAY: {
      const elemType = buffer.readUInt32LE(offset) as GgufValueType;
      const arrayLen = Number(buffer.readBigUInt64LE(offset + 4));
      let currentOffset = offset + 12;
      const arr = [];
      for (let i = 0; i < Math.min(arrayLen, 20); i++) {
        const item = parseGgufValue(buffer, currentOffset, elemType);
        arr.push(item.value);
        currentOffset = item.newOffset;
      }
      return { value: arr, newOffset: currentOffset };
    }
    default:
      return { value: null, newOffset: offset + 4 };
  }
}

function detectQuantFromFilename(name: string): string {
  const match = name.match(/Q\d_[A-Z0-9_]+|F16|F32|IQ\d_[A-Z0-9_]+/i);
  return match ? match[0].toUpperCase() : 'GGUF';
}

function fileTypeToQuantString(type: number): string | null {
  const quantMap: Record<number, string> = {
    0: 'F32',
    1: 'F16',
    2: 'Q4_0',
    3: 'Q4_1',
    7: 'Q8_0',
    8: 'Q5_0',
    9: 'Q5_1',
    10: 'Q2_K',
    11: 'Q3_K_S',
    12: 'Q3_K_M',
    13: 'Q3_K_L',
    14: 'Q4_K_S',
    15: 'Q4_K_M',
    16: 'Q5_K_S',
    17: 'Q5_K_M',
    18: 'Q6_K',
  };
  return quantMap[type] || null;
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`;
}
