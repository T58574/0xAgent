import { execSync } from 'node:child_process';

export interface HardwareInfo {
  vendor: 'NVIDIA' | 'AMD' | 'Intel' | 'Apple' | 'CPU';
  gpuName: string;
  recommendedBuild: string;
  recommendedAssetKeywords: string[];
  isAutoDetected: boolean;
}

export function detectGpuHardware(): HardwareInfo {
  const result: HardwareInfo = {
    vendor: 'CPU',
    gpuName: 'Processor / Universal Graphics',
    recommendedBuild: 'Vulkan / AVX2',
    recommendedAssetKeywords: ['bin-win-vulkan', 'bin-win-x64'],
    isAutoDetected: false,
  };

  try {
    if (process.platform === 'win32') {
      const command = `powershell -NoProfile -Command "Get-CimInstance Win32_VideoCard | Select-Object -ExpandProperty Name"`;
      const stdout = execSync(command, { encoding: 'utf-8' }).trim();

      if (stdout && stdout.length > 0) {
        result.isAutoDetected = true;
        const gpus = stdout.split(/\r?\n/).map(g => g.trim()).filter(Boolean);
        result.gpuName = gpus.join(', ');

        const combinedName = stdout.toUpperCase();

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
      result.gpuName = 'Apple Silicon / Metal';
      result.recommendedBuild = 'Metal / macOS';
      result.recommendedAssetKeywords = ['macos', 'arm64'];
    }
  } catch (err) {
    console.error('Failed to detect GPU hardware:', err);
  }

  return result;
}
