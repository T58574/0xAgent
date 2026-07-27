import { execSync } from 'node:child_process';
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

export function detectGpuHardware(): HardwareInfo {
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
      let stdout = '';

      try {
        const command = `powershell -NoProfile -Command "Get-CimInstance Win32_VideoController | Select-Object Name, AdapterRAM | ConvertTo-Json"`;
        stdout = execSync(command, { encoding: 'utf-8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
      } catch {
        try {
          stdout = execSync('wmic path win32_videocontroller get name', { encoding: 'utf-8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
        } catch {}
      }

      if (stdout && stdout.length > 0) {
        result.isAutoDetected = true;

        if (stdout.startsWith('{') || stdout.startsWith('[')) {
          try {
            const parsed = JSON.parse(stdout);
            const controllers = Array.isArray(parsed) ? parsed : [parsed];
            const names = controllers.map((c: any) => c.Name).filter(Boolean);
            result.gpuName = names.join(', ');

            // Find primary GPU VRAM
            for (const c of controllers) {
              if (c.AdapterRAM && typeof c.AdapterRAM === 'number' && c.AdapterRAM > 0) {
                result.vramMB = Math.round(c.AdapterRAM / (1024 * 1024));
                break;
              }
            }
          } catch {
            result.gpuName = stdout;
          }
        } else {
          const gpus = stdout.split(/\r?\n/).map((g) => g.trim()).filter((g) => g && g.toLowerCase() !== 'name');
          result.gpuName = gpus.join(', ');
        }

        const combinedName = result.gpuName.toUpperCase();

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
  } catch {
    // Ignore hardware detection errors gracefully
  }

  return result;
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
      ? `Обнаружен GPU (${hw.gpuName}). Активирован полный offload (-ngl 99), FlashAttention (-fa 1), батчинг (-b 2048 -ub 512) и ${recommendedThreads} ядер CPU.`
      : `Режим CPU. Установлено ${recommendedThreads} потоков, отмена GPU Offload и Mmap для макс. стабильности.`,
  };
}
