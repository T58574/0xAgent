import { exec, execSync } from 'node:child_process';
import os from 'node:os';

export interface HardwareInfo {
  vendor: 'NVIDIA' | 'AMD' | 'Intel' | 'Apple' | 'CPU';
  gpuName: string;
  recommendedBuild: string;
  recommendedAssetKeywords: string[];
  isAutoDetected: boolean;
  vramMB?: number;
  ramGB: number;
  cpuCores: number;
}

export interface OptimalLlamaConfig {
  gpu_layers: number;
  flash_attn: boolean;
  batch_size: number;
  ubatch_size: number;
  threads: number;
  ctx_size: number;
  mmap: boolean;
  cont_batching: boolean;
  reasoning: string;
}

let cachedHardwareInfo: HardwareInfo | null = null;

function parseNvidiaSmiVram(): number | undefined {
  try {
    const stdout = execSync('nvidia-smi --query-gpu=memory.total --format=csv,noheader,nounits', {
      encoding: 'utf-8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
    const firstLine = stdout.split(/\r?\n/)[0];
    const val = parseInt(firstLine, 10);
    if (!isNaN(val) && val > 0) {
      return val;
    }
  } catch {}
  return undefined;
}

function queryWindowsGpuAsync(): Promise<{ gpuName: string; vramMB?: number }> {
  return new Promise((resolve) => {
    const command = `powershell -NoProfile -Command "Get-CimInstance Win32_VideoController | Select-Object Name, AdapterRAM | ConvertTo-Json"`;
    exec(command, { encoding: 'utf-8' }, (err, stdout) => {
      if (err || !stdout || !stdout.trim()) {
        exec('wmic path win32_videocontroller get name', { encoding: 'utf-8' }, (wmicErr, wmicStdout) => {
          if (wmicErr || !wmicStdout) {
            resolve({ gpuName: '' });
            return;
          }
          const gpus = wmicStdout.split(/\r?\n/).map((g) => g.trim()).filter((g) => g && g.toLowerCase() !== 'name');
          resolve({ gpuName: gpus.join(', '), vramMB: parseNvidiaSmiVram() });
        });
        return;
      }

      const trimmed = stdout.trim();
      let gpuName = trimmed;
      let vramMB: number | undefined = undefined;

      if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
        try {
          const parsed = JSON.parse(trimmed);
          const controllers = Array.isArray(parsed) ? parsed : [parsed];
          const names = controllers.map((c: any) => c.Name).filter(Boolean);
          gpuName = names.join(', ');

          for (const c of controllers) {
            if (c.AdapterRAM !== undefined && c.AdapterRAM !== null) {
              const rawRam = Number(c.AdapterRAM);
              // Handle unsigned 32-bit wrap around or negative int from WMI
              const uintRam = rawRam < 0 ? rawRam + 4294967296 : rawRam;
              if (uintRam > 0) {
                vramMB = Math.round(uintRam / (1024 * 1024));
                break;
              }
            }
          }
        } catch {}
      } else {
        const gpus = trimmed.split(/\r?\n/).map((g) => g.trim()).filter((g) => g && g.toLowerCase() !== 'name');
        gpuName = gpus.join(', ');
      }

      // If GPU is NVIDIA, prefer nvidia-smi for precise VRAM (>4GB WMI overflow protection)
      if (gpuName.toUpperCase().includes('NVIDIA') || gpuName.toUpperCase().includes('GEFORCE')) {
        const smiVram = parseNvidiaSmiVram();
        if (smiVram) vramMB = smiVram;
      }

      resolve({ gpuName, vramMB });
    });
  });
}

export async function detectGpuHardwareAsync(): Promise<HardwareInfo> {
  if (cachedHardwareInfo) return cachedHardwareInfo;

  const ramGB = Math.round(os.totalmem() / (1024 * 1024 * 1024));
  const cpuCores = os.cpus().length;

  const result: HardwareInfo = {
    vendor: 'CPU',
    gpuName: 'Processor / Universal Graphics',
    recommendedBuild: 'Vulkan / AVX2',
    recommendedAssetKeywords: ['bin-win-vulkan', 'bin-win-x64'],
    isAutoDetected: false,
    ramGB,
    cpuCores,
  };

  try {
    if (process.platform === 'win32') {
      const { gpuName, vramMB } = await queryWindowsGpuAsync();
      if (gpuName) {
        result.isAutoDetected = true;
        result.gpuName = gpuName;
        result.vramMB = vramMB;

        const combinedName = gpuName.toUpperCase();
        if (combinedName.includes('NVIDIA') || combinedName.includes('GEFORCE') || combinedName.includes('QUADRO')) {
          result.vendor = 'NVIDIA';
          result.recommendedBuild = 'CUDA (bin-win-cuda)';
          result.recommendedAssetKeywords = ['bin-win-cuda', 'bin-win-vulkan'];
        } else if (combinedName.includes('AMD') || combinedName.includes('RADEON') || combinedName.includes('RX ')) {
          result.vendor = 'AMD';
          result.recommendedBuild = 'Vulkan (bin-win-vulkan)';
          result.recommendedAssetKeywords = ['bin-win-vulkan', 'bin-win-x64'];
        } else if (combinedName.includes('INTEL') || combinedName.includes('ARC ')) {
          result.vendor = 'Intel';
          result.recommendedBuild = 'Vulkan / SYCL (bin-win-vulkan)';
          result.recommendedAssetKeywords = ['bin-win-vulkan', 'bin-win-x64'];
        }
      }
    } else if (process.platform === 'darwin') {
      result.isAutoDetected = true;
      result.vendor = 'Apple';
      result.gpuName = 'Apple Silicon / Metal Unified Memory';
      result.recommendedBuild = 'Metal / macOS';
      result.recommendedAssetKeywords = ['macos', 'arm64'];
    }
  } catch {}

  cachedHardwareInfo = result;
  return result;
}

export function detectGpuHardware(): HardwareInfo {
  if (cachedHardwareInfo) return cachedHardwareInfo;
  const ramGB = Math.round(os.totalmem() / (1024 * 1024 * 1024));
  const cpuCores = os.cpus().length;
  return {
    vendor: 'CPU',
    gpuName: 'Processor / Universal Graphics',
    recommendedBuild: 'Vulkan / AVX2',
    recommendedAssetKeywords: ['bin-win-vulkan', 'bin-win-x64'],
    isAutoDetected: false,
    ramGB,
    cpuCores,
  };
}

export function calculateOptimalLlamaConfig(hw: HardwareInfo): OptimalLlamaConfig {
  const isGpuAvailable = hw.vendor !== 'CPU';
  
  // Physical threads calculation
  const recommendedThreads = Math.max(1, Math.floor(hw.cpuCores > 8 ? hw.cpuCores / 2 : hw.cpuCores - 1));

  // Context size calculation based on available RAM/VRAM
  let recommendedCtx = 16384;
  if (hw.ramGB >= 32 || (hw.vramMB && hw.vramMB >= 12000)) {
    recommendedCtx = 32768;
  } else if (hw.ramGB < 16) {
    recommendedCtx = 8192;
  }

  return {
    gpu_layers: isGpuAvailable ? 99 : 0,
    flash_attn: isGpuAvailable,
    batch_size: 2048,
    ubatch_size: 512,
    threads: recommendedThreads,
    ctx_size: recommendedCtx,
    mmap: true,
    cont_batching: true,
    reasoning: isGpuAvailable
      ? `Обнаружен GPU (${hw.gpuName}${hw.vramMB ? ` - ${Math.round(hw.vramMB / 1024)}GB VRAM` : ''}). Активирован полный offload (-ngl 99), FlashAttention (-fa 1), батчинг (-b 2048 -ub 512) и ${recommendedThreads} ядер CPU.`
      : `Режим CPU. Установлено ${recommendedThreads} потоков, отмена GPU Offload и Mmap для макс. стабильности.`,
  };
}
