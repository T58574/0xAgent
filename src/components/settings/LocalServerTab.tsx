import React, { useState, useEffect, useRef } from 'react';
import { Cpu, Folder, AlertTriangle, Zap, Activity, RefreshCw, HardDrive } from 'lucide-react';
import { GgufMetadata, HardwareInfo, LocalModelItem } from '../../types';
import * as api from '../../services/api';
import { useToast } from '../../context/ToastContext';
import { LlamaInstallerSection } from './localServer/LlamaInstallerSection';
import { InstalledVersionsSection } from './localServer/InstalledVersionsSection';
import { ServerPerformanceParams } from './localServer/ServerPerformanceParams';
import { ServerLogsConsole } from './localServer/ServerLogsConsole';

interface LocalServerTabProps {
  exePath: string;
  setExePath: (val: string) => void;
  modelPath: string;
  setModelPath: (val: string) => void;
  host: string;
  setHost: (val: string) => void;
  port: number;
  setPort: (val: number) => void;
  ctxSize: number;
  setCtxSize: (val: number) => void;
  threads: number;
  setThreads: (val: number) => void;
  gpuLayers: number;
  setGpuLayers: (val: number) => void;
  temp: number;
  setTemp: (val: number) => void;
  batchSize: number;
  setBatchSize: (val: number) => void;
  ubatchSize: number;
  setUbatchSize: (val: number) => void;
  minP: number;
  setMinP: (val: number) => void;
  topK: number;
  setTopK: (val: number) => void;
  topP: number;
  setTopP: (val: number) => void;
  predict: number;
  setPredict: (val: number) => void;
  repeatPenalty: number;
  setRepeatPenalty: (val: number) => void;
  flashAttn: boolean;
  setFlashAttn: (val: boolean) => void;
  mmap: boolean;
  setMmap: (val: boolean) => void;
  mlock: boolean;
  setMlock: (val: boolean) => void;
  embedding: boolean;
  setEmbedding: (val: boolean) => void;
  contBatching: boolean;
  setContBatching: (val: boolean) => void;
  promptCache: boolean;
  setPromptCache: (val: boolean) => void;
  parallelSlots: number;
  setParallelSlots: (val: number) => void;
  cacheReuse: number;
  setCacheReuse: (val: number) => void;
  slotSavePath: string;
  setSlotSavePath: (val: string) => void;
  customArgs: string;
  setCustomArgs: (val: string) => void;
  specDraftModel: string;
  setSpecDraftModel: (val: string) => void;
  specType: string;
  setSpecType: (val: string) => void;
  specDraftNgl: number;
  setSpecDraftNgl: (val: number) => void;
  specDraftNMax: number;
  setSpecDraftNMax: (val: number) => void;
  specDraftPMin: number;
  setSpecDraftPMin: (val: number) => void;
  jinja: boolean;
  setJinja: (val: boolean) => void;
  reasoningPreserve: boolean;
  setReasoningPreserve: (val: boolean) => void;
  reasoningFormat: string;
  setReasoningFormat: (val: string) => void;
  serverStatus: 'stopped' | 'running' | 'checking';
  setServerStatus: (val: 'stopped' | 'running' | 'checking') => void;
  serverLogs: string[];
  setServerLogs: React.Dispatch<React.SetStateAction<string[]>>;
  serverLogsAutoScroll: boolean;
  setServerLogsAutoScroll: (val: boolean) => void;
  setApiUrl: (val: string) => void;
}

export const LocalServerTab: React.FC<LocalServerTabProps> = ({
  exePath,
  setExePath,
  modelPath,
  setModelPath,
  host,
  setHost,
  port,
  setPort,
  ctxSize,
  setCtxSize,
  threads,
  setThreads,
  gpuLayers,
  setGpuLayers,
  temp,
  setTemp,
  batchSize,
  setBatchSize,
  ubatchSize,
  setUbatchSize,
  minP,
  setMinP,
  topK,
  setTopK,
  topP,
  setTopP,
  predict,
  setPredict,
  repeatPenalty,
  setRepeatPenalty,
  flashAttn,
  setFlashAttn,
  mmap,
  setMmap,
  mlock,
  setMlock,
  embedding,
  setEmbedding,
  contBatching,
  setContBatching,
  promptCache,
  setPromptCache,
  parallelSlots,
  setParallelSlots,
  cacheReuse,
  setCacheReuse,
  slotSavePath,
  setSlotSavePath,
  customArgs,
  setCustomArgs,
  specDraftModel,
  setSpecDraftModel,
  specType,
  setSpecType,
  specDraftNgl,
  setSpecDraftNgl,
  specDraftNMax,
  setSpecDraftNMax,
  specDraftPMin,
  setSpecDraftPMin,
  jinja,
  setJinja,
  reasoningPreserve,
  setReasoningPreserve,
  reasoningFormat,
  setReasoningFormat,
  serverStatus,
  setServerStatus,
  serverLogs,
  setServerLogs,
  serverLogsAutoScroll,
  setServerLogsAutoScroll,
  setApiUrl: _setApiUrl,
}) => {
  const { showToast } = useToast();
  const [logFilePath, setLogFilePath] = useState<string>('');
  const [isCopiedLogs, setIsCopiedLogs] = useState(false);
  const logsContainerRef = useRef<HTMLDivElement>(null);
  const logsEndRef = useRef<HTMLDivElement>(null);

  const [isInstallingLlama, setIsInstallingLlama] = useState(false);
  const [githubReleases, setGithubReleases] = useState<any[]>([]);
  const [selectedTag, setSelectedTag] = useState<string>('');
  const [selectedAssetUrl, setSelectedAssetUrl] = useState<string>('');
  const [selectedAssetName, setSelectedAssetName] = useState<string>('');
  const [installedVersions, setInstalledVersions] = useState<{ tag: string; exePath: string; isCurrent: boolean }[]>([]);
  const [isLoadingReleases, setIsLoadingReleases] = useState(false);

  // Auto cleanup & Download animation states
  const [autoCleanupOld, setAutoCleanupOld] = useState(true);
  const [justDownloadedTag, setJustDownloadedTag] = useState<string | null>(null);
  const [isCleaningOld, setIsCleaningOld] = useState(false);
  const [deletingTag, setDeletingTag] = useState<string | null>(null);

  // Metadata, Hardware, Slots, Modal, Adviser, Scanned Models
  const [modelMeta, setModelMeta] = useState<GgufMetadata | null>(null);
  const [hardwareInfo, setHardwareInfo] = useState<HardwareInfo | null>(null);
  const [healthStatus, setHealthStatus] = useState<'ok' | 'loading' | 'stopped'>('stopped');
  const [slotMetrics, setSlotMetrics] = useState<{ totalSlots: number; activeSlots: number }>({ totalSlots: 0, activeSlots: 0 });
  const [crashAdvice, setCrashAdvice] = useState<string | null>(null);
  const [scannedLocalModels, setScannedLocalModels] = useState<LocalModelItem[]>([]);

  const refreshScannedModels = async () => {
    try {
      const res = await api.get_available_models();
      if (res && res.local) {
        setScannedLocalModels(res.local);
      }
    } catch (err) {
      console.error('Failed to scan local models:', err);
    }
  };

  useEffect(() => {
    async function loadData() {
      try {
        setIsLoadingReleases(true);
        const [releases, installed, hw, statusInfo, serverLogsInfo, availableModels] = await Promise.all([
          api.get_llama_releases().catch(() => []),
          api.get_installed_llama_versions().catch(() => []),
          api.detect_hardware().catch(() => null),
          api.get_server_status().catch(() => null),
          api.get_server_logs().catch(() => null),
          api.get_available_models().catch(() => null),
        ]);

        setGithubReleases(releases);
        setInstalledVersions(installed);
        setHardwareInfo(hw);
        if (availableModels && availableModels.local) {
          setScannedLocalModels(availableModels.local);
        }

        if (serverLogsInfo) {
          if (serverLogsInfo.logs && serverLogsInfo.logs.length > 0) {
            setServerLogs(serverLogsInfo.logs);
          }
          if (serverLogsInfo.logFilePath) {
            setLogFilePath(serverLogsInfo.logFilePath);
          }
        }

        if (statusInfo && statusInfo.running) {
          setServerStatus('running');
        } else if (serverLogsInfo && serverLogsInfo.running) {
          setServerStatus('running');
        } else {
          setServerStatus('stopped');
        }

        if (releases.length > 0) {
          const first = releases[0];
          setSelectedTag(first.tag);
          if (first.assets && first.assets.length > 0) {
            let prefAsset = null;
            if (hw?.recommendedAssetKeywords) {
              for (const kw of hw.recommendedAssetKeywords) {
                prefAsset = first.assets.find((a: any) => a.name.includes(kw));
                if (prefAsset) break;
              }
            }
            if (!prefAsset) prefAsset = first.assets[0];
            setSelectedAssetUrl(prefAsset.download_url);
            setSelectedAssetName(prefAsset.name);
          }
        }
      } catch (err) {
        console.error('Failed to load Llama data:', err);
      } finally {
        setIsLoadingReleases(false);
      }
    }
    loadData();
  }, []);

  // Parse GGUF Metadata whenever modelPath changes
  useEffect(() => {
    if (modelPath && modelPath.trim().length > 0) {
      api.parse_gguf(modelPath.trim())
        .then((meta) => setModelMeta(meta))
        .catch(() => setModelMeta(null));
    } else {
      setModelMeta(null);
    }
  }, [modelPath]);

  // Health & Slots Polling Timer
  useEffect(() => {
    let timer: any = null;
    if (serverStatus === 'running') {
      timer = setInterval(async () => {
        try {
          const h = await api.get_server_health(host, port);
          setHealthStatus(h.status === 'ok' || h.status === 'loading' ? h.status : 'stopped');
          if (h.ok) {
            const s = await api.get_server_slots(host, port);
            setSlotMetrics({ totalSlots: s.totalSlots, activeSlots: s.activeSlots });
          }
        } catch {}
      }, 2000);
    } else {
      setHealthStatus('stopped');
      setSlotMetrics({ totalSlots: 0, activeSlots: 0 });
    }
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [serverStatus, host, port]);

  // Log Inspection Crash Adviser
  useEffect(() => {
    const logsStr = serverLogs.join('\n');
    if (logsStr.includes('expected   5120, 248320') || logsStr.includes('expected 5120, 248320') || logsStr.includes('check_tensor_dims: tensor \'output.weight\'')) {
      setCrashAdvice('Советчик FastMTP: Сайдкар FastMTP для Qwen 3.8 требует пропатченный бинарник llama-server (HauhauCS-FastMTP-llama.cpp.patch для d2t trim). Для запуска без драфта выберите "[x] Отключить" в выпадающем списке Draft/FastMTP модели.');
    } else if (logsStr.includes('pinned memory') || logsStr.includes('CUDA error') || logsStr.includes('out of memory')) {
      if (!mmap) {
        setCrashAdvice('Советчик: Падение вызвано опцией --no-mmap. Включите Mmap обратно или уменьшите число GPU слоев.');
      } else {
        setCrashAdvice('Советчик: Падение вызвано нехваткой VRAM. Уменьшите количество GPU слоев (-ngl) или размер контекста (-c).');
      }
    } else {
      setCrashAdvice(null);
    }
  }, [serverLogs, mmap]);

  const handleTagChange = (tag: string) => {
    setSelectedTag(tag);
    const rel = githubReleases.find((r) => r.tag === tag);
    if (rel && rel.assets && rel.assets.length > 0) {
      let prefAsset = null;
      if (hardwareInfo?.recommendedAssetKeywords) {
        for (const kw of hardwareInfo.recommendedAssetKeywords) {
          prefAsset = rel.assets.find((a: any) => a.name.includes(kw));
          if (prefAsset) break;
        }
      }
      if (!prefAsset) prefAsset = rel.assets[0];
      setSelectedAssetUrl(prefAsset.download_url);
      setSelectedAssetName(prefAsset.name);
    }
  };

  const refreshInstalledVersions = async () => {
    try {
      const list = await api.get_installed_llama_versions();
      setInstalledVersions(list);
      return list;
    } catch (err) {
      console.error('Failed to refresh installed versions:', err);
      return [];
    }
  };

  const handleSelectExe = async () => {
    try {
      const file = await api.select_file_native("Executable Files (*.exe)|*.exe|All Files (*.*)|*.*");
      if (file) setExePath(file);
    } catch (err) {
      console.error('Failed to select file:', err);
    }
  };

  const handleSelectModel = async () => {
    try {
      const file = await api.select_file_native("GGUF Model Files (*.gguf)|*.gguf|All Files (*.*)|*.*");
      if (file) setModelPath(file);
    } catch (err) {
      console.error('Failed to select GGUF model:', err);
    }
  };

  const handleSelectDraftModel = async () => {
    try {
      const file = await api.select_file_native("GGUF Draft/MTP Files (*.gguf)|*.gguf|All Files (*.*)|*.*");
      if (file) setSpecDraftModel(file);
    } catch (err) {
      console.error('Failed to select Draft/MTP model:', err);
    }
  };

  const handleSelectSlotSavePath = async () => {
    try {
      const folder = await api.select_workspace();
      if (folder) setSlotSavePath(folder);
    } catch (err) {
      console.error('Failed to select slot save folder:', err);
    }
  };

  const handleInstallSelectedLlamaVersion = async () => {
    if (!selectedTag) return;
    setIsInstallingLlama(true);
    setJustDownloadedTag(null);
    try {
      const res = await api.install_llama_version(selectedTag, selectedAssetUrl, selectedAssetName, autoCleanupOld);
      setExePath(res.exePath);
      await refreshInstalledVersions();
      setJustDownloadedTag(selectedTag);
      showToast(res.message || `Llama.cpp (${selectedTag}) успешно установлен!`, 'success');
      setTimeout(() => {
        setJustDownloadedTag((prev) => (prev === selectedTag ? null : prev));
      }, 6000);
    } catch (err: any) {
      showToast(`Ошибка установки: ${err.message || err}`, 'error');
    } finally {
      setIsInstallingLlama(false);
    }
  };

  const handleSelectInstalledVersion = async (vExePath: string) => {
    try {
      const res = await api.select_installed_llama(vExePath);
      setExePath(res.exePath);
      await refreshInstalledVersions();
      showToast(res.message || 'Активная версия переключена!', 'success');
    } catch (err: any) {
      showToast(`Ошибка переключения: ${err.message || err}`, 'error');
    }
  };

  const handleDeleteInstalledVersion = async (tag: string, vExePath: string) => {
    setDeletingTag(tag);
    try {
      const res = await api.delete_installed_llama(tag, vExePath);
      const updated = await refreshInstalledVersions();
      if (exePath.toLowerCase() === vExePath.toLowerCase()) {
        if (updated.length > 0) {
          setExePath(updated[0].exePath);
        } else {
          setExePath('');
        }
      }
      showToast(res.message || `Сборка ${tag} удалена!`, 'success');
    } catch (err: any) {
      showToast(`Ошибка удаления: ${err.message || err}`, 'error');
    } finally {
      setDeletingTag(null);
    }
  };

  const handleCleanupOldVersions = async () => {
    setIsCleaningOld(true);
    try {
      const res = await api.cleanup_old_llama_versions(selectedTag);
      await refreshInstalledVersions();
      showToast(res.message, res.removedCount > 0 ? 'success' : 'info');
    } catch (err: any) {
      showToast(`Ошибка очистки: ${err.message || err}`, 'error');
    } finally {
      setIsCleaningOld(false);
    }
  };

  useEffect(() => {
    const un1 = api.listen<string>('llama-server-log', (data) => {
      setServerLogs((prev) => [...prev, data.payload]);
    });

    const un2 = api.listen<{ status: string; error?: string }>('llama-server-status', (data) => {
      if (data.payload.status === 'running') {
        setServerStatus('running');
      } else if (data.payload.status === 'stopped') {
        setServerStatus('stopped');
        setHealthStatus('stopped');
      }
    });

    return () => {
      un1();
      un2();
    };
  }, []);

  const handleClearLogs = () => {
    setServerLogs([]);
  };

  const handleDownloadLogs = () => {
    const text = serverLogs.join('\n');
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'llama-server.log';
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleCopyLogs = () => {
    navigator.clipboard.writeText(serverLogs.join('\n'));
    setIsCopiedLogs(true);
    setTimeout(() => setIsCopiedLogs(false), 2000);
  };

  const handleApplyFastPreset = () => {
    setGpuLayers(99);
    setThreads(0);
    setBatchSize(2048);
    setUbatchSize(512);
    setFlashAttn(true);
    setParallelSlots(1);
    setCacheReuse(256);
    setCtxSize(16384);
    setCustomArgs('-ctk q8_0 -ctv q8_0');
    showToast('Применен быстрый пресет (Flash Attention + Q8 KV + 1 слот)!', 'success');
  };

  const handleApplyFastMtpPreset = () => {
    setSpecType('draft-mtp');
    setSpecDraftNMax(3);
    setSpecDraftNgl(99);
    setSpecDraftPMin(0);
    setJinja(true);
    setReasoningPreserve(true);
    setReasoningFormat('deepseek');
    setGpuLayers(99);
    setThreads(0);
    setBatchSize(2048);
    setUbatchSize(512);
    setFlashAttn(true);
    setMmap(false);
    setTopK(20);
    setTopP(0.95);
    setTemp(1.0);
    setMinP(0);
    setRepeatPenalty(1.0);
    setParallelSlots(1);
    setCtxSize(32768);

    // Auto-locate FastMTP draft model if present in scanned models
    const draftModel = scannedLocalModels.find((m) => /fastmtp|qwen3.*mtp/i.test(m.fileName));
    if (draftModel) {
      setSpecDraftModel(draftModel.filePath);
    }
    showToast('Применен пресет FastMTP для Qwen 3.8 (до 3x ускорения текста и 1.9x рассуждений)!', 'success');
  };

  const isSelectedVersionInstalled = installedVersions.some(
    (v) => v.tag.toLowerCase() === selectedTag.toLowerCase()
  );

  const mainLocalModels = scannedLocalModels.filter((m) => !m.isDraft && !m.isMmproj);
  const draftLocalModels = scannedLocalModels.filter((m) => m.isDraft || /fastmtp|mtp|draft/i.test(m.fileName));

  return (
    <div className="space-y-4 font-sans text-[var(--theme-text)] max-w-full">
      {/* Top Header & Live Health Metric */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 border-b border-[var(--theme-border)] pb-3">
        <div>
          <h3 className="text-sm font-semibold text-[var(--theme-text)] flex items-center gap-2">
            <Cpu size={16} className="text-[var(--theme-text-muted)]" />
            <span>Параметры и Логи ИИ-Сервера Llama.cpp</span>
          </h3>
          <p className="text-xs text-[var(--theme-text-muted)] mt-0.5">
            Настройка локального ИИ-движка, выбор релизов и просмотр реальных логов работы.
          </p>
        </div>

        {/* Live Slot & Health Metrics Badge */}
        {serverStatus === 'running' && (
          <div className="flex items-center gap-2 text-xs font-mono bento-card px-3 py-1.5 rounded-lg select-none">
            <Activity size={13} className="text-[var(--theme-text-muted)] animate-pulse" />
            <span className="text-[var(--theme-text)] font-medium">
              {healthStatus === 'loading'
                ? 'Загрузка модели в GPU...'
                : healthStatus === 'ok'
                ? `Готов | Слоты: ${slotMetrics.activeSlots}/${slotMetrics.totalSlots || 1}`
                : 'Инициализация...'}
            </span>
          </div>
        )}
      </div>

      {/* Crash Advisory Alert Box */}
      {crashAdvice && (
        <div className="p-3 rounded-xl bento-card border border-[var(--theme-border)] text-xs flex items-start gap-2 animate-fadeIn bg-white/5">
          <AlertTriangle size={15} className="shrink-0 mt-0.5 text-amber-400" />
          <span>{crashAdvice}</span>
        </div>
      )}

      {/* MAIN 2-COLUMN GRID LAYOUT */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        
        {/* LEFT COLUMN: Server Settings & Controls */}
        <div className="lg:col-span-7 space-y-3.5">
          
          {/* Hardware GPU Status Banner */}
          {hardwareInfo && hardwareInfo.isAutoDetected && (
            <div className="p-3.5 rounded-xl bento-card flex items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-2.5">
                <div className="p-1.5 rounded-lg bg-white/5 border border-[var(--theme-border)] text-[var(--theme-text-muted)]">
                  <Zap size={15} />
                </div>
                <div>
                  <div className="flex items-center gap-2 font-medium text-[var(--theme-text)]">
                    <span>Видеокарта:</span>
                    <span className="font-mono text-[var(--theme-text)]">{hardwareInfo.gpuName}</span>
                    <span className="px-2 py-0.5 rounded-md bg-white/10 text-[var(--theme-text)] border border-[var(--theme-border)] font-mono text-[10px]">
                      Full GPU Offload (-ngl 999)
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* GitHub Releases Llama.cpp Installer Section */}
          <div className="space-y-3">
            <LlamaInstallerSection
              githubReleases={githubReleases}
              selectedTag={selectedTag}
              onTagChange={handleTagChange}
              selectedAssetUrl={selectedAssetUrl}
              onAssetUrlChange={(url, name) => {
                setSelectedAssetUrl(url);
                if (name) setSelectedAssetName(name);
              }}
              isLoadingReleases={isLoadingReleases}
              isInstallingLlama={isInstallingLlama}
              autoCleanupOld={autoCleanupOld}
              setAutoCleanupOld={setAutoCleanupOld}
              justDownloadedTag={justDownloadedTag}
              isSelectedVersionInstalled={isSelectedVersionInstalled}
              onInstall={handleInstallSelectedLlamaVersion}
            />

            <InstalledVersionsSection
              installedVersions={installedVersions}
              isCleaningOld={isCleaningOld}
              deletingTag={deletingTag}
              onSelectVersion={handleSelectInstalledVersion}
              onDeleteVersion={handleDeleteInstalledVersion}
              onCleanupOld={handleCleanupOldVersions}
            />
          </div>

          {/* Executable Path & Model Selector Card */}
          <div className="p-4 rounded-xl bento-card space-y-3">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-[var(--theme-text)] flex items-center justify-between">
                <span>Исполняемый файл (llama-server.exe)</span>
                <button
                  type="button"
                  onClick={handleSelectExe}
                  className="text-[11px] text-[var(--theme-text-muted)] hover:text-[var(--theme-text)] flex items-center gap-1 cursor-pointer font-normal"
                >
                  <Folder size={12} />
                  <span>Обзор...</span>
                </button>
              </label>
              <input
                type="text"
                value={exePath}
                onChange={(e) => setExePath(e.target.value)}
                placeholder="~/.0xagent/llama/llama-server.exe"
                className="w-full px-3 py-2 rounded-lg bento-card text-xs font-mono text-[var(--theme-text)] bg-black/40 focus:outline-none"
              />
            </div>

            <div className="space-y-1.5 pt-1">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-[var(--theme-text)] flex items-center gap-1.5">
                  <HardDrive size={13} className="text-[var(--theme-text-muted)]" />
                  <span>Файл GGUF Модели (.gguf)</span>
                </label>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={refreshScannedModels}
                    className="text-[11px] text-[var(--theme-text-muted)] hover:text-[var(--theme-text)] flex items-center gap-1 cursor-pointer font-normal"
                    title="Пересканировать папку models/"
                  >
                    <RefreshCw size={11} />
                    <span>Сканировать</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleSelectModel}
                    className="text-[11px] text-[var(--theme-text-muted)] hover:text-[var(--theme-text)] flex items-center gap-1 cursor-pointer font-normal"
                    title="Выбрать файл через проводник"
                  >
                    <Folder size={12} />
                    <span>Обзор...</span>
                  </button>
                </div>
              </div>

              {/* Local GGUF Scanned Dropdown */}
              <select
                value={
                  mainLocalModels.find(
                    (m) => m.filePath.toLowerCase() === modelPath.toLowerCase() || m.fileName.toLowerCase() === modelPath.toLowerCase()
                  )?.filePath || (modelPath ? 'custom' : '')
                }
                onChange={(e) => {
                  const val = e.target.value;
                  if (val && val !== 'custom') {
                    setModelPath(val);
                  }
                }}
                className="w-full px-3 py-2 rounded-lg bento-card text-xs font-mono text-[var(--theme-text)] bg-black/40 focus:outline-none cursor-pointer"
              >
                <option value="" className="bg-black">-- Выберите локальную GGUF модель из ~/.0xagent/models/ --</option>
                {mainLocalModels.map((m) => (
                  <option key={m.id || m.filePath} value={m.filePath} className="bg-black">
                    {m.title || m.fileName} ({m.quantization} • {m.sizeGB})
                  </option>
                ))}
                {modelPath && !mainLocalModels.some((m) => m.filePath.toLowerCase() === modelPath.toLowerCase()) && (
                  <option value="custom" className="bg-black">Пользовательский путь: {modelPath}</option>
                )}
              </select>

              {/* Full Absolute Path Details Input */}
              <input
                type="text"
                value={modelPath}
                onChange={(e) => setModelPath(e.target.value)}
                placeholder="~/.0xagent/models/model.gguf"
                className="w-full px-3 py-1.5 rounded-lg bento-card text-[11px] font-mono text-[var(--theme-text-muted)] bg-black/40 focus:outline-none focus:text-[var(--theme-text)]"
              />
            </div>

            {/* GGUF Model Metadata Card with Reasoning Specs */}
            {modelMeta && (
              <div className="p-3 rounded-lg bg-black/40 border border-[var(--theme-border)] text-xs space-y-2 font-mono">
                <div className="flex items-center justify-between text-[var(--theme-text)] font-semibold border-b border-[var(--theme-border)] pb-1.5">
                  <div className="flex items-center gap-2 truncate">
                    <span className="truncate">{modelMeta.cleanTitle || modelMeta.modelName || modelMeta.architecture}</span>
                    <span className="px-1.5 py-0.5 rounded bg-white/10 text-[10px] text-white/80">
                      {modelMeta.quantization}
                    </span>
                  </div>
                  <span className="px-1.5 py-0.5 rounded bg-white/10 text-[var(--theme-text-muted)] text-[10px] shrink-0">
                    {modelMeta.fileSizeFormatted}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 text-[11px]">
                  <div className="flex items-center justify-between text-[var(--theme-text-muted)]">
                    <span>Семейство:</span>
                    <span className="text-[var(--theme-text)] font-medium uppercase">{modelMeta.family || 'GGUF'}</span>
                  </div>
                  <div className="flex items-center justify-between text-[var(--theme-text-muted)]">
                    <span>Контекст обучения:</span>
                    <span className="text-[var(--theme-text)] font-medium">{modelMeta.contextLength.toLocaleString()} tok</span>
                  </div>
                  <div className="flex items-center justify-between text-[var(--theme-text-muted)]">
                    <span>Рассуждения &lt;think&gt;:</span>
                    <span className={modelMeta.supportsReasoning ? 'text-sky-400 font-medium' : 'text-zinc-400'}>
                      {modelMeta.supportsReasoning ? 'Поддерживается' : 'Instruct / Direct'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-[var(--theme-text-muted)]">
                    <span>Реком. режим:</span>
                    <span className="text-white font-medium uppercase">
                      {modelMeta.recommendedReasoningEffort || 'AUTO'}
                    </span>
                  </div>
                </div>

                {modelMeta.supportsFastMtp && (
                  <div className="flex items-center justify-between text-[11px] border-t border-[var(--theme-border)] pt-1.5 mt-1">
                    <span className="text-sky-300">FastMTP Ускорение:</span>
                    <span className="px-1.5 py-0.5 rounded bg-sky-500/20 text-sky-300 border border-sky-500/30 text-[10px] font-bold">
                      СОВМЕСТИМО (3x Speed)
                    </span>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Performance Parameters Component */}
          <ServerPerformanceParams
            host={host}
            setHost={setHost}
            port={port}
            setPort={setPort}
            ctxSize={ctxSize}
            setCtxSize={setCtxSize}
            threads={threads}
            setThreads={setThreads}
            gpuLayers={gpuLayers}
            setGpuLayers={setGpuLayers}
            temp={temp}
            setTemp={setTemp}
            batchSize={batchSize}
            setBatchSize={setBatchSize}
            ubatchSize={ubatchSize}
            setUbatchSize={setUbatchSize}
            minP={minP}
            setMinP={setMinP}
            topK={topK}
            setTopK={setTopK}
            topP={topP}
            setTopP={setTopP}
            predict={predict}
            setPredict={setPredict}
            repeatPenalty={repeatPenalty}
            setRepeatPenalty={setRepeatPenalty}
            flashAttn={flashAttn}
            setFlashAttn={setFlashAttn}
            mmap={mmap}
            setMmap={setMmap}
            mlock={mlock}
            setMlock={setMlock}
            embedding={embedding}
            setEmbedding={setEmbedding}
            contBatching={contBatching}
            setContBatching={setContBatching}
            promptCache={promptCache}
            setPromptCache={setPromptCache}
            parallelSlots={parallelSlots}
            setParallelSlots={setParallelSlots}
            cacheReuse={cacheReuse}
            setCacheReuse={setCacheReuse}
            slotSavePath={slotSavePath}
            setSlotSavePath={setSlotSavePath}
            customArgs={customArgs}
            setCustomArgs={setCustomArgs}
            specDraftModel={specDraftModel}
            setSpecDraftModel={setSpecDraftModel}
            specType={specType}
            setSpecType={setSpecType}
            specDraftNgl={specDraftNgl}
            setSpecDraftNgl={setSpecDraftNgl}
            specDraftNMax={specDraftNMax}
            setSpecDraftNMax={setSpecDraftNMax}
            specDraftPMin={specDraftPMin}
            setSpecDraftPMin={setSpecDraftPMin}
            jinja={jinja}
            setJinja={setJinja}
            reasoningPreserve={reasoningPreserve}
            setReasoningPreserve={setReasoningPreserve}
            reasoningFormat={reasoningFormat}
            setReasoningFormat={setReasoningFormat}
            scannedDraftModels={draftLocalModels}
            onSelectDraftModelFile={handleSelectDraftModel}
            onSelectSlotSavePath={handleSelectSlotSavePath}
            onApplyFastPreset={handleApplyFastPreset}
            onApplyFastMtpPreset={handleApplyFastMtpPreset}
          />
        </div>

        {/* RIGHT COLUMN: Terminal Logs Console */}
        <div className="lg:col-span-5">
          <ServerLogsConsole
            serverLogs={serverLogs}
            logFilePath={logFilePath}
            serverLogsAutoScroll={serverLogsAutoScroll}
            setServerLogsAutoScroll={setServerLogsAutoScroll}
            isCopiedLogs={isCopiedLogs}
            onCopyLogs={handleCopyLogs}
            onDownloadLogs={handleDownloadLogs}
            onClearLogs={handleClearLogs}
            logsContainerRef={logsContainerRef}
            logsEndRef={logsEndRef}
          />
        </div>

      </div>
    </div>
  );
};
