import fs from 'node:fs';
import path from 'node:path';
import { GgufMetadata, ReasoningEffortLevel } from '../src/types';

export type { GgufMetadata };

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
  let offset = 24; // GGUF Header: 4 (magic) + 4 (version) + 8 (tensor_count) + 8 (kv_count) = 24

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

      const { value, newOffset } = parseGgufValue(buffer, offset, valType, bytesRead);
      offset = newOffset;

      rawKv[key] = value;
    } catch {
      break;
    }
  }
  return rawKv;
}

function formatModelTitle(modelName: string, fileName: string, rawKv: Record<string, any> = {}): string {
  let baseName = rawKv['general.name'] || modelName || fileName.replace(/\.gguf$/i, '');
  const sizeLabel = rawKv['general.size_label'] || '';

  // Clean technical quant/hash suffixes
  let cleanTitle = String(baseName)
    .replace(/[-_.]?(Q\d_[A-Z0-9_]+|Q\d_K_[SML]|IQ\d_[A-Z0-9_]+|F16|F32|BF16)$/i, '')
    .replace(/[-_.]?(Q\d_[A-Z0-9_]+|Q\d_K_[SML]|IQ\d_[A-Z0-9_]+|F16|F32|BF16)[-_.]/i, ' ')
    .replace(/[-_]/g, ' ')
    .trim();

  if (/^rvn\b/i.test(cleanTitle) && !/qwen/i.test(cleanTitle)) {
    cleanTitle = cleanTitle.replace(/^rvn\b/i, 'Raven (Qwen 3.8)').trim();
  }

  if (sizeLabel && !cleanTitle.toLowerCase().includes(sizeLabel.toLowerCase())) {
    cleanTitle = `${cleanTitle} ${sizeLabel}`.trim();
  }

  if (!cleanTitle) cleanTitle = fileName.replace(/\.gguf$/i, '');
  return cleanTitle;
}

export function detectModelReasoningCapabilities(
  modelName: string,
  fileName: string,
  architecture: string = '',
  rawKv: Record<string, any> = {}
): {
  family: 'qwen' | 'gemma' | 'deepseek' | 'phi' | 'llama' | 'mistral' | 'unknown';
  supportsReasoning: boolean;
  recommendedReasoningEffort: ReasoningEffortLevel;
  supportedReasoningLevels: ReasoningEffortLevel[];
} {
  const metaName = String(rawKv['general.name'] || '');
  const metaBasename = String(rawKv['general.basename'] || '');
  const metaArch = String(rawKv['general.architecture'] || architecture || '');
  const combined = `${modelName} ${fileName} ${architecture} ${metaName} ${metaBasename} ${metaArch}`.toLowerCase();

  // 1. Qwen 3 / Qwen 3.8 / Qwen 3.5 / Raven Series
  if (
    metaArch === 'qwen35' ||
    metaArch.startsWith('qwen3') ||
    combined.includes('qwen3') ||
    combined.includes('qwen-3') ||
    combined.includes('qwen_3') ||
    combined.includes('qwen 3') ||
    combined.includes('qwen38') ||
    combined.includes('qwen3.8') ||
    combined.includes('rvn-') ||
    combined.includes('rvn_') ||
    combined.includes('raven')
  ) {
    return {
      family: 'qwen',
      supportsReasoning: true,
      recommendedReasoningEffort: 'xhigh',
      supportedReasoningLevels: ['off', 'low', 'medium', 'xhigh'],
    };
  }

  // 2. DeepSeek R1 / Distill models
  if (combined.includes('deepseek-r1') || combined.includes('r1-distill') || combined.includes('deepseek_r1') || combined.includes('r1_distill')) {
    return {
      family: 'deepseek',
      supportsReasoning: true,
      recommendedReasoningEffort: 'high',
      supportedReasoningLevels: ['off', 'low', 'medium', 'high'],
    };
  }

  // 3. Gemma 4 / Gemma 3 Series
  if (
    combined.includes('gemma-4') ||
    combined.includes('gemma4') ||
    combined.includes('gemma 4') ||
    combined.includes('gemma-3') ||
    combined.includes('gemma3')
  ) {
    return {
      family: 'gemma',
      supportsReasoning: true,
      recommendedReasoningEffort: 'medium',
      supportedReasoningLevels: ['off', 'low', 'medium', 'high'],
    };
  }

  // 4. Gemma 2 Series
  if (combined.includes('gemma-2') || combined.includes('gemma2') || combined.includes('gemma')) {
    return {
      family: 'gemma',
      supportsReasoning: false,
      recommendedReasoningEffort: 'off',
      supportedReasoningLevels: ['off', 'low', 'medium'],
    };
  }

  // 5. Phi-4 Series
  if (combined.includes('phi-4') || combined.includes('phi4') || combined.includes('phi_4')) {
    return {
      family: 'phi',
      supportsReasoning: true,
      recommendedReasoningEffort: 'medium',
      supportedReasoningLevels: ['off', 'low', 'medium', 'high'],
    };
  }

  // 6. Qwen 2.5 Coder / Qwen 2.5
  if (combined.includes('qwen2.5') || combined.includes('qwen-2.5') || combined.includes('qwen')) {
    return {
      family: 'qwen',
      supportsReasoning: false,
      recommendedReasoningEffort: 'off',
      supportedReasoningLevels: ['off', 'low', 'medium'],
    };
  }

  // 7. Mistral / Codestral / Pixtral
  if (combined.includes('mistral') || combined.includes('codestral') || combined.includes('pixtral') || combined.includes('devstral')) {
    return {
      family: 'mistral',
      supportsReasoning: false,
      recommendedReasoningEffort: 'off',
      supportedReasoningLevels: ['off', 'low', 'medium'],
    };
  }

  // 8. Llama 3 / 3.1 / 3.3
  if (combined.includes('llama')) {
    return {
      family: 'llama',
      supportsReasoning: false,
      recommendedReasoningEffort: 'off',
      supportedReasoningLevels: ['off', 'low', 'medium'],
    };
  }

  // Default Fallback
  return {
    family: 'unknown',
    supportsReasoning: false,
    recommendedReasoningEffort: 'auto',
    supportedReasoningLevels: ['auto', 'off', 'low', 'medium', 'high'],
  };
}

export function parseGgufMetadata(filePath: string): GgufMetadata {
  const fileName = path.basename(filePath);
  const stats = fs.statSync(filePath);
  const fileSizeBytes = stats.size;
  const fileSizeFormatted = formatBytes(fileSizeBytes);

  const isMmprojFile = /mmproj|projector|clip/i.test(fileName);
  // Draft files are standalone sidecars, usually small (< 3 GB) with explicit draft marker
  const isDraftFile = !isMmprojFile && fileSizeBytes < 3 * 1024 * 1024 * 1024 && (/(?:^|[._-])(?:draft|fastmtp-draft)(?:[._-]|$)/i.test(fileName) || /-(?:draft|fastmtp)\.gguf$/i.test(fileName));

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
    isMmproj: isMmprojFile,
    isDraft: isDraftFile,
    isFastMtp: /fastmtp/i.test(fileName),
    supportsFastMtp: false,
    rawKv: {},
  };

  let fd: number | null = null;
  try {
    fd = fs.openSync(filePath, 'r');
    // Buffer size: allocate up to 16 MB using allocUnsafe for zero-overhead GC performance
    const bufferSize = Math.min(1024 * 1024 * 16, fileSizeBytes);
    const buffer = Buffer.allocUnsafe(bufferSize);
    const bytesRead = fs.readSync(fd, buffer, 0, bufferSize, 0);

    if (bytesRead >= 24 && buffer.toString('ascii', 0, 4) === 'GGUF') {
      result.magicValid = true;
      result.version = buffer.readUInt32LE(4);
      const kvCount = Number(buffer.readBigUInt64LE(16));

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

  const reasoningCaps = detectModelReasoningCapabilities(result.modelName, fileName, result.architecture, result.rawKv);
  result.family = reasoningCaps.family;
  result.supportsReasoning = reasoningCaps.supportsReasoning;
  result.recommendedReasoningEffort = reasoningCaps.recommendedReasoningEffort;
  result.supportedReasoningLevels = reasoningCaps.supportedReasoningLevels;
  const hasNextnPredict = Boolean(result.rawKv?.['qwen35.nextn_predict_layers'] || result.rawKv?.['qwen3.nextn_predict_layers'] || /mtp/i.test(fileName));
  result.supportsFastMtp = (result.family === 'qwen' || hasNextnPredict || /qwen3/i.test(fileName) || /qwen/i.test(result.modelName)) && !result.isDraft && !result.isMmproj;

  const sizeGBNum = fileSizeBytes / (1024 * 1024 * 1024);
  const sizeGB = `${sizeGBNum.toFixed(2)} GB`;
  const cleanTitle = formatModelTitle(result.modelName, fileName, result.rawKv);

  result.cleanTitle = cleanTitle;
  result.sizeGB = sizeGB;
  result.formattedName = `${cleanTitle} [${result.quantization}] (${sizeGB})`;

  return result;
}

function parseGgufValue(buffer: Buffer, offset: number, type: GgufValueType, maxBytes: number = buffer.length): { value: any; newOffset: number } {
  if (offset >= maxBytes) return { value: null, newOffset: maxBytes };

  switch (type) {
    case GgufValueType.UINT8:
      if (offset + 1 > maxBytes) return { value: null, newOffset: maxBytes };
      return { value: buffer.readUInt8(offset), newOffset: offset + 1 };
    case GgufValueType.INT8:
      if (offset + 1 > maxBytes) return { value: null, newOffset: maxBytes };
      return { value: buffer.readInt8(offset), newOffset: offset + 1 };
    case GgufValueType.UINT16:
      if (offset + 2 > maxBytes) return { value: null, newOffset: maxBytes };
      return { value: buffer.readUInt16LE(offset), newOffset: offset + 2 };
    case GgufValueType.INT16:
      if (offset + 2 > maxBytes) return { value: null, newOffset: maxBytes };
      return { value: buffer.readInt16LE(offset), newOffset: offset + 2 };
    case GgufValueType.UINT32:
      if (offset + 4 > maxBytes) return { value: null, newOffset: maxBytes };
      return { value: buffer.readUInt32LE(offset), newOffset: offset + 4 };
    case GgufValueType.INT32:
      if (offset + 4 > maxBytes) return { value: null, newOffset: maxBytes };
      return { value: buffer.readInt32LE(offset), newOffset: offset + 4 };
    case GgufValueType.FLOAT32:
      if (offset + 4 > maxBytes) return { value: null, newOffset: maxBytes };
      return { value: buffer.readFloatLE(offset), newOffset: offset + 4 };
    case GgufValueType.BOOL:
      if (offset + 1 > maxBytes) return { value: null, newOffset: maxBytes };
      return { value: buffer.readUInt8(offset) !== 0, newOffset: offset + 1 };
    case GgufValueType.STRING: {
      if (offset + 8 > maxBytes) return { value: '', newOffset: maxBytes };
      const strLen = Number(buffer.readBigUInt64LE(offset));
      if (strLen < 0 || offset + 8 + strLen > maxBytes) {
        return { value: '', newOffset: maxBytes };
      }
      const strVal = buffer.toString('utf-8', offset + 8, offset + 8 + strLen);
      return { value: strVal, newOffset: offset + 8 + strLen };
    }
    case GgufValueType.UINT64:
      if (offset + 8 > maxBytes) return { value: null, newOffset: maxBytes };
      return { value: Number(buffer.readBigUInt64LE(offset)), newOffset: offset + 8 };
    case GgufValueType.INT64:
      if (offset + 8 > maxBytes) return { value: null, newOffset: maxBytes };
      return { value: Number(buffer.readBigInt64LE(offset)), newOffset: offset + 8 };
    case GgufValueType.FLOAT64:
      if (offset + 8 > maxBytes) return { value: null, newOffset: maxBytes };
      return { value: buffer.readDoubleLE(offset), newOffset: offset + 8 };
    case GgufValueType.ARRAY: {
      if (offset + 12 > maxBytes) return { value: [], newOffset: maxBytes };
      const elemType = buffer.readUInt32LE(offset) as GgufValueType;
      const arrayLen = Number(buffer.readBigUInt64LE(offset + 4));
      let currentOffset = offset + 12;
      const arr = [];
      const previewLimit = Math.min(arrayLen, 20);

      // Read first previewLimit items into array
      for (let i = 0; i < previewLimit && currentOffset < maxBytes - 4; i++) {
        const item = parseGgufValue(buffer, currentOffset, elemType, maxBytes);
        arr.push(item.value);
        currentOffset = item.newOffset;
      }

      // Skip remaining elements if any
      const remaining = arrayLen - previewLimit;
      if (remaining > 0 && currentOffset < maxBytes) {
        const fixedSize = getGgufTypeSize(elemType);
        if (fixedSize > 0) {
          currentOffset = Math.min(maxBytes, currentOffset + remaining * fixedSize);
        } else if (elemType === GgufValueType.STRING) {
          for (let i = 0; i < remaining && currentOffset + 8 <= maxBytes; i++) {
            const strLen = Number(buffer.readBigUInt64LE(currentOffset));
            if (strLen < 0 || currentOffset + 8 + strLen > maxBytes) {
              currentOffset = maxBytes;
              break;
            }
            currentOffset += 8 + strLen;
          }
        } else {
          for (let i = 0; i < remaining && currentOffset < maxBytes - 4; i++) {
            const item = parseGgufValue(buffer, currentOffset, elemType, maxBytes);
            currentOffset = item.newOffset;
          }
        }
      }

      return { value: arr, newOffset: Math.min(currentOffset, maxBytes) };
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
