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
  cleanTitle?: string;
  sizeGB?: string;
  formattedName?: string;
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

function readGgufKvPairs(buffer: Buffer, bytesRead: number, kvCount: number): Record<string, any> {
  const rawKv: Record<string, any> = {};
  let offset = 20;

  for (let i = 0; i < kvCount && offset < bytesRead - 8; i++) {
    try {
      const keyLen = Number(buffer.readBigUInt64LE(offset));
      offset += 8;
      if (keyLen <= 0 || keyLen > 256 || offset + keyLen >= bytesRead) break;

      const key = buffer.toString('utf-8', offset, offset + keyLen);
      offset += keyLen;

      if (offset + 4 >= bytesRead) break;
      const valType = buffer.readUInt32LE(offset) as GgufValueType;
      offset += 4;

      const { value, newOffset } = parseGgufValue(buffer, offset, valType);
      offset = newOffset;

      rawKv[key] = value;
    } catch {
      break;
    }
  }
  return rawKv;
}

function formatModelTitle(modelName: string, fileName: string): string {
  let cleanTitle = modelName || fileName.replace(/\.gguf$/i, '');
  cleanTitle = cleanTitle
    .replace(/[-_.]?(Q\d_[A-Z0-9_]+|Q\d_K_[SML]|IQ\d_[A-Z0-9_]+|F16|F32|BF16)$/i, '')
    .replace(/[-_.]?(Q\d_[A-Z0-9_]+|Q\d_K_[SML]|IQ\d_[A-Z0-9_]+|F16|F32|BF16)[-_.]/i, ' ')
    .replace(/[-_]/g, ' ')
    .trim();
  if (!cleanTitle) cleanTitle = fileName.replace(/\.gguf$/i, '');
  return cleanTitle;
}

export function parseGgufMetadata(filePath: string): GgufMetadata {
  const fileName = path.basename(filePath);
  const stats = fs.statSync(filePath);
  const fileSizeBytes = stats.size;
  const fileSizeFormatted = formatBytes(fileSizeBytes);

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
    const bufferSize = Math.min(1024 * 1024 * 1.5, fileSizeBytes);
    const buffer = Buffer.alloc(bufferSize);
    const bytesRead = fs.readSync(fd, buffer, 0, bufferSize, 0);

    if (bytesRead >= 12 && buffer.toString('ascii', 0, 4) === 'GGUF') {
      result.magicValid = true;
      result.version = buffer.readUInt32LE(4);
      const kvCount = Number(buffer.readBigUInt64LE(12));

      result.rawKv = readGgufKvPairs(buffer, bytesRead, kvCount);

      if (result.rawKv['general.architecture']) {
        result.architecture = String(result.rawKv['general.architecture']);
      }
      if (result.rawKv['general.name']) {
        result.modelName = String(result.rawKv['general.name']);
      }
      const arch = result.architecture !== 'unknown' ? result.architecture : 'llama';
      if (result.rawKv[`${arch}.block_count`] !== undefined) {
        result.blockCount = Number(result.rawKv[`${arch}.block_count`]);
      } else if (result.rawKv['llama.block_count'] !== undefined) {
        result.blockCount = Number(result.rawKv['llama.block_count']);
      }
      if (result.rawKv[`${arch}.context_length`] !== undefined) {
        result.contextLength = Number(result.rawKv[`${arch}.context_length`]);
      } else if (result.rawKv['llama.context_length'] !== undefined) {
        result.contextLength = Number(result.rawKv['llama.context_length']);
      }
      if (result.rawKv[`${arch}.expert_count`] !== undefined) {
        result.expertCount = Number(result.rawKv[`${arch}.expert_count`]);
      }
      if (result.rawKv['general.file_type'] !== undefined) {
        const parsedQuant = fileTypeToQuantString(Number(result.rawKv['general.file_type']));
        if (parsedQuant) result.quantization = parsedQuant;
      }
    }
  } catch (err: any) {
    console.error(`Error reading GGUF header for ${fileName}:`, err.message);
  } finally {
    if (fd !== null) {
      try {
        fs.closeSync(fd);
      } catch {}
    }
  }

  const sizeGBNum = fileSizeBytes / (1024 * 1024 * 1024);
  const sizeGB = `${sizeGBNum.toFixed(2)} GB`;
  const cleanTitle = formatModelTitle(result.modelName, fileName);

  result.cleanTitle = cleanTitle;
  result.sizeGB = sizeGB;
  result.formattedName = `${cleanTitle} [${result.quantization}] (${sizeGB})`;

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
      const previewLimit = Math.min(arrayLen, 20);

      // Read first previewLimit items into array
      for (let i = 0; i < previewLimit && currentOffset < buffer.length - 4; i++) {
        const item = parseGgufValue(buffer, currentOffset, elemType);
        arr.push(item.value);
        currentOffset = item.newOffset;
      }

      // Skip remaining elements if any
      const remaining = arrayLen - previewLimit;
      if (remaining > 0 && currentOffset < buffer.length) {
        const fixedSize = getGgufTypeSize(elemType);
        if (fixedSize > 0) {
          currentOffset += remaining * fixedSize;
        } else if (elemType === GgufValueType.STRING) {
          for (let i = 0; i < remaining && currentOffset + 8 <= buffer.length; i++) {
            const strLen = Number(buffer.readBigUInt64LE(currentOffset));
            currentOffset += 8 + strLen;
          }
        } else {
          for (let i = 0; i < remaining && currentOffset < buffer.length - 4; i++) {
            const item = parseGgufValue(buffer, currentOffset, elemType);
            currentOffset = item.newOffset;
          }
        }
      }

      return { value: arr, newOffset: Math.min(currentOffset, buffer.length) };
    }
    default:
      return { value: null, newOffset: offset + 4 };
  }
}

function getGgufTypeSize(type: GgufValueType): number {
  switch (type) {
    case GgufValueType.UINT8:
    case GgufValueType.INT8:
    case GgufValueType.BOOL:
      return 1;
    case GgufValueType.UINT16:
    case GgufValueType.INT16:
      return 2;
    case GgufValueType.UINT32:
    case GgufValueType.INT32:
    case GgufValueType.FLOAT32:
      return 4;
    case GgufValueType.UINT64:
    case GgufValueType.INT64:
    case GgufValueType.FLOAT64:
      return 8;
    default:
      return 0;
  }
}

function detectQuantFromFilename(name: string): string {
  const match = name.match(/Q\d_[A-Z0-9_]+|Q\d_K_[A-Z0-9_]+|Q\d_K|IQ\d_[A-Z0-9_]+|BF16|F16|F32/i);
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
