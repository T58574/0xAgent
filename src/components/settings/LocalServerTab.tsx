import React, { useState, useEffect, useRef } from 'react';
import { Cpu, Play, Square, Folder, Download, HardDrive, RefreshCw, AlertTriangle, Zap, Activity, Search, Trash2, Trash, Copy, FileText, Terminal, Check } from 'lucide-react';
import { GgufMetadata, HardwareInfo } from '../../types';
import { ModelPickerModal } from '../ModelPickerModal';
import * as api from '../../services/api';
import { useToast } from '../../context/ToastContext';

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
  serverStatus,
  setServerStatus,
  serverLogs,
  setServerLogs,
  serverLogsAutoScroll,
  setServerLogsAutoScroll,
  setApiUrl,
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


  // New Phase 1 States: Metadata, Hardware, Slots, Modal, Adviser
  const [modelMeta, setModelMeta] = useState<GgufMetadata | null>(null);
  const [hardwareInfo, setHardwareInfo] = useState<HardwareInfo | null>(null);
  const [isPickerModalOpen, setIsPickerModalOpen] = useState(false);
  const [healthStatus, setHealthStatus] = useState<'ok' | 'loading' | 'stopped'>('stopped');
  const [slotMetrics, setSlotMetrics] = useState<{ totalSlots: number; activeSlots: number }>({ totalSlots: 0, activeSlots: 0 });
  const [crashAdvice, setCrashAdvice] = useState<string | null>(null);

  // 1. Initial Load: Hardware, Releases, Server Logs & Initial Server Status
  useEffect(() => {
    async function loadData() {
      try {
        setIsLoadingReleases(true);
        const [releases, installed, hw, statusInfo, serverLogsInfo] = await Promise.all([
          api.get_llama_releases().catch(() => []),
          api.get_installed_llama_versions().catch(() => []),
          api.detect_hardware().catch(() => null),
          api.get_server_status().catch(() => null),
          api.get_server_logs().catch(() => null),
        ]);

        setGithubReleases(releases);
        setInstalledVersions(installed);
        setHardwareInfo(hw);

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
            // Auto-select asset based on GPU detection
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

  // 2. Parse GGUF Metadata whenever modelPath changes
  useEffect(() => {
    if (modelPath && modelPath.trim().length > 0) {
      api.parse_gguf(modelPath.trim())
        .then((meta) => {
          setModelMeta(meta);
        })
        .catch(() => setModelMeta(null));
    } else {
      setModelMeta(null);
    }
  }, [modelPath]);

  // 3. Health & Slots Polling Timer
  useEffect(() => {
    let timer: any = null;
    if (serverStatus === 'running') {
      timer = setInterval(async () => {
        try {
          const h = await api.get_server_health(host, port);
          setHealthStatus(h.status as any);
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

  // 4. Log Inspection Crash Adviser
  useEffect(() => {
    const logsStr = serverLogs.join('\n');
    if (logsStr.includes('pinned memory') || logsStr.includes('CUDA error') || logsStr.includes('out of memory')) {
      if (!mmap) {
        setCrashAdvice('Советчик по ошибкам: Падение сервера вызваны включенной опцией --no-mmap (отключение Mmap). Включите Mmap обратно или уменьшите число GPU слоев.');
      } else {
        setCrashAdvice('Советчик по ошибкам: Падение вызвано нехваткой VRAM на видеокарте. Уменьшите количество GPU слоев (-ngl) или размер контекста (-c).');
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
      showToast(`Ошибка переключения версии: ${err.message || err}`, 'error');
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
      showToast(`Ошибка удаления сборки: ${err.message || err}`, 'error');
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
      showToast(`Ошибка очистки старых версий: ${err.message || err}`, 'error');
    } finally {
      setIsCleaningOld(false);
    }
  };

  // Listen to live WebSocket log stream and server status from llama-server process
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

  const handleStartServer = async () => {
    setHealthStatus('loading');
    setApiUrl(`http://${host}:${port}/v1`);
    setServerLogs((prev) => [...prev, `[SYSTEM] Launching llama.cpp server at http://${host}:${port}/v1...`]);

    try {
      const res = await api.start_local_server({
        exePath,
        modelPath,
        host,
        port,
        ctxSize,
        gpuLayers,
        threads,
        batchSize,
        ubatchSize,
        temp,
        repeatPenalty,
        minP,
        topK,
        topP,
        predict,
        flashAttn,
        mmap,
        mlock,
        embedding,
        contBatching,
        parallelSlots,
        cacheReuse,
        slotSavePath,
        customArgs,
      });
      if (res && res.success) {
        setServerStatus('running');
      }
    } catch (err: any) {
      setServerStatus('stopped');
      setHealthStatus('stopped');
      const errMsg = err.message || err;
      setServerLogs((prev) => [...prev, `[SYSTEM ERROR] Failed to start server:\n${errMsg}`]);
      showToast(`Ошибка запуска сервера llama.cpp:\n${errMsg}`, 'error');
    }
  };


  const handleStopServer = async () => {
    try {
      await api.stop_local_server();
    } catch {}
    setServerStatus('stopped');
    setHealthStatus('stopped');
    setServerLogs((prev) => [...prev, '[SYSTEM] Server stopped.']);
  };

  useEffect(() => {
    if (serverLogsAutoScroll && logsContainerRef.current) {
      logsContainerRef.current.scrollTop = logsContainerRef.current.scrollHeight;
    }
  }, [serverLogs, serverLogsAutoScroll]);

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
    setThreads(8);
    setBatchSize(512);
    setUbatchSize(512);
    setFlashAttn(false);
    setParallelSlots(2);
    setCacheReuse(256);
    setCtxSize(65536);
    showToast('Применен пресет быстрой работы (50+ t/s)!', 'success');
  };

  const toggleItems = [
    { label: 'Flash Attention (-fa)', value: flashAttn, toggle: () => setFlashAttn(!flashAttn) },
    { label: 'Prompt Cache', value: promptCache, toggle: () => setPromptCache(!promptCache) },
    { label: 'Use Memory Map (--mmap)', value: mmap, toggle: () => setMmap(!mmap) },
    { label: 'Lock Memory (--mlock)', value: mlock, toggle: () => setMlock(!mlock) },
    { label: 'Continuous Batching', value: contBatching, toggle: () => setContBatching(!contBatching) },
    { label: 'Embeddings Output', value: embedding, toggle: () => setEmbedding(!embedding) },
  ];

  const currentRel = githubReleases.find((r) => r.tag === selectedTag);
  const isSelectedVersionInstalled = installedVersions.some(
    (v) => v.tag.toLowerCase() === selectedTag.toLowerCase()
  );

  return (
    <div className="space-y-5 font-sans text-slate-100 max-w-full">
      {/* Top Header & Live Health Metric */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 border-b border-white/10 pb-4">
        <div>
          <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
            <Cpu size={18} className="text-emerald-400" />
            <span>Параметры и Логи ИИ-Сервера Llama.cpp</span>
          </h3>
          <p className="text-xs text-slate-400 mt-0.5">
            Настройка локального ИИ-движка, выбора релиза с GitHub и просмотр реальных логов работы в режиме реального времени.
          </p>
        </div>

        {/* Live Slot & Health Metrics Badge */}
        {serverStatus === 'running' && (
          <div className="flex items-center gap-2 text-xs font-mono bg-emerald-950/80 px-3 py-1.5 rounded-lg border border-emerald-500/40 select-none shadow-md">
            <Activity size={14} className={healthStatus === 'ok' ? 'text-emerald-400 animate-pulse' : 'text-amber-400 animate-spin'} />
            <span className="text-emerald-200 font-semibold">
              {healthStatus === 'loading'
                ? 'Загрузка модели в память GPU...'
                : healthStatus === 'ok'
                ? `Готов | Слоты: ${slotMetrics.activeSlots}/${slotMetrics.totalSlots || 4}`
                : 'Процесс запущен | Инициализация...'}
            </span>
          </div>
        )}
      </div>

      {/* Crash Advisory Alert Box */}
      {crashAdvice && (
        <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/40 text-amber-300 text-xs flex items-start gap-2 animate-fadeIn shadow-lg">
          <AlertTriangle size={16} className="shrink-0 mt-0.5" />
          <span>{crashAdvice}</span>
        </div>
      )}

      {/* MAIN 2-COLUMN GRID LAYOUT: Left = Params & Installers (7/12), Right = Full-Height Terminal Logs (5/12) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* LEFT COLUMN: Server Settings & Controls */}
        <div className="lg:col-span-7 space-y-4">
          
          {/* Hardware GPU Status Banner */}
          {hardwareInfo && hardwareInfo.isAutoDetected && (
            <div className="p-3.5 rounded-xl bg-slate-900/90 border border-emerald-500/30 flex items-center justify-between gap-3 text-xs shadow-md">
              <div className="flex items-center gap-2.5">
                <div className="p-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-400">
                  <Zap size={16} />
                </div>
                <div>
                  <div className="flex items-center gap-2 font-semibold text-slate-200">
                    <span>Видеокарта:</span>
                    <span className="text-emerald-300 font-mono">{hardwareInfo.gpuName}</span>
                    <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-mono text-[10px]">
                      100% Full GPU Offload (-ngl 999)
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* GitHub Releases Llama.cpp Installer Card */}
          <div className="p-4 rounded-xl glass-card border border-white/10 space-y-4">
            <div className="space-y-3 pb-3 border-b border-white/10">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
                <div>
                  <div className="text-xs font-semibold text-slate-200 flex items-center gap-1.5">
                    <Download size={14} className="text-emerald-400" />
                    <span>Официальный установщик Llama.cpp с GitHub</span>
                  </div>
                  <div className="text-xs text-slate-400 mt-0.5">
                    Выбирайте любую версию релиза llama.cpp из GitHub и сохраняйте её локально на диске
                  </div>
                </div>
                {isLoadingReleases && (
                  <div className="flex items-center gap-1.5 text-xs text-sky-400">
                    <RefreshCw size={12} className="animate-spin" />
                    <span>Загрузка релизов...</span>
                  </div>
                )}
              </div>

              {/* Release Tag Dropdown & Asset Selection */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                <div className="space-y-1">
                  <label className="text-[11px] font-medium text-slate-300">
                    Версия релиза llama.cpp (GitHub Tag)
                  </label>
                  <select
                    value={selectedTag}
                    onChange={(e) => handleTagChange(e.target.value)}
                    disabled={githubReleases.length === 0 || isInstallingLlama}
                    className="w-full px-3 py-1.5 rounded flat-input text-xs font-mono text-slate-100 focus:outline-none cursor-pointer"
                  >
                    {githubReleases.map((rel) => (
                      <option key={rel.tag} value={rel.tag} className="bg-slate-900 text-slate-100">
                        {rel.name} ({rel.tag})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-medium text-slate-300">
                    Бинарный файл релиза (Asset)
                  </label>
                  <select
                    value={selectedAssetUrl}
                    onChange={(e) => {
                      setSelectedAssetUrl(e.target.value);
                      const asset = currentRel?.assets.find((a: any) => a.download_url === e.target.value);
                      if (asset) setSelectedAssetName(asset.name);
                    }}
                    disabled={!currentRel || isInstallingLlama}
                    className="w-full px-3 py-1.5 rounded flat-input text-xs font-mono text-slate-100 focus:outline-none cursor-pointer"
                  >
                    {currentRel?.assets.map((asset: any) => (
                      <option key={asset.download_url} value={asset.download_url} className="bg-slate-900 text-slate-100">
                        {asset.name} ({asset.size})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Auto Cleanup Old Versions Checkbox & Download Action */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2 pt-1">
                <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={autoCleanupOld}
                    onChange={(e) => setAutoCleanupOld(e.target.checked)}
                    className="rounded bg-slate-950 border-white/20 text-emerald-500 focus:ring-0"
                  />
                  <span>Автоматически удалять предыдущую установку при скачивании новой</span>
                </label>

                <div className="flex items-center gap-2 shrink-0">
                  {justDownloadedTag === selectedTag && (
                    <span className="px-2.5 py-1 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-xs font-semibold animate-pulse">
                      Установлено!
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={handleInstallSelectedLlamaVersion}
                    disabled={!selectedAssetUrl || isInstallingLlama}
                    className="flat-btn px-4 py-1.5 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/40 text-xs font-semibold flex items-center gap-1.5 disabled:opacity-50 cursor-pointer transition-all shadow-md"
                  >
                    {isInstallingLlama ? (
                      <>
                        <RefreshCw size={13} className="animate-spin" />
                        <span>Загрузка и распаковка...</span>
                      </>
                    ) : (
                      <>
                        <Download size={13} />
                        <span>{isSelectedVersionInstalled ? 'Переустановить' : 'Скачать и установить'}</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>

            {/* Installed Llama Versions Manager Table */}
            {installedVersions.length > 0 && (
              <div className="space-y-2 pt-1">
                <div className="flex items-center justify-between text-xs text-slate-300 font-semibold">
                  <div className="flex items-center gap-1.5">
                    <HardDrive size={13} className="text-sky-400" />
                    <span>Установленные версии ({installedVersions.length})</span>
                  </div>
                  {installedVersions.length > 1 && (
                    <button
                      type="button"
                      onClick={handleCleanupOldVersions}
                      disabled={isCleaningOld}
                      className="text-[11px] text-rose-400 hover:text-rose-300 flex items-center gap-1 cursor-pointer"
                    >
                      {isCleaningOld ? <RefreshCw size={11} className="animate-spin" /> : <Trash size={11} />}
                      <span>Очистить старые версии</span>
                    </button>
                  )}
                </div>

                <div className="space-y-1.5">
                  {installedVersions.map((ver) => (
                    <div
                      key={ver.exePath}
                      className={`p-2 rounded-lg border text-xs flex items-center justify-between transition-all ${
                        ver.isCurrent
                          ? 'bg-emerald-950/40 border-emerald-500/40 text-emerald-200'
                          : 'bg-slate-900/60 border-white/10 text-slate-300'
                      }`}
                    >
                      <div className="flex items-center gap-2 font-mono truncate">
                        <span className="font-bold text-slate-100">{ver.tag}</span>
                        {ver.isCurrent && (
                          <span className="px-1.5 py-0.2 rounded bg-emerald-500/30 text-emerald-300 text-[10px] font-sans font-semibold">
                            Активная
                          </span>
                        )}
                        <span className="text-[10px] text-slate-400 truncate max-w-[200px]" title={ver.exePath}>
                          {ver.exePath}
                        </span>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        {!ver.isCurrent && (
                          <button
                            type="button"
                            onClick={() => handleSelectInstalledVersion(ver.exePath)}
                            className="flat-btn px-2 py-1 rounded text-[11px] bg-sky-500/20 text-sky-300 border border-sky-500/30 hover:bg-sky-500/30"
                          >
                            Выбрать
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => handleDeleteInstalledVersion(ver.tag, ver.exePath)}
                          disabled={deletingTag === ver.tag}
                          className="p-1 rounded text-rose-400 hover:bg-rose-500/20 hover:text-rose-300 transition-colors"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Executable Path & Model Selector */}
          <div className="p-4 rounded-xl glass-card border border-white/10 space-y-3">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-200 flex items-center justify-between">
                <span>Исполняемый файл (llama-server.exe)</span>
                <button
                  type="button"
                  onClick={handleSelectExe}
                  className="text-[11px] text-sky-400 hover:text-sky-300 flex items-center gap-1 cursor-pointer font-normal"
                >
                  <Folder size={12} />
                  <span>Обзор...</span>
                </button>
              </label>
              <input
                type="text"
                value={exePath}
                onChange={(e) => setExePath(e.target.value)}
                placeholder="C:\Users\user\.0xagent\llama\llama-server.exe"
                className="w-full px-3 py-2 rounded flat-input text-xs font-mono text-slate-100 placeholder-slate-500 focus:outline-none"
              />
            </div>

            <div className="space-y-1 pt-1">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-slate-200">
                  Файл GGUF Модели (.gguf)
                </label>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setIsPickerModalOpen(true)}
                    className="text-[11px] text-emerald-400 hover:text-emerald-300 flex items-center gap-1 cursor-pointer font-semibold bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/30"
                  >
                    <Search size={12} />
                    <span>Сканер моделей</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleSelectModel}
                    className="text-[11px] text-sky-400 hover:text-sky-300 flex items-center gap-1 cursor-pointer font-normal"
                  >
                    <Folder size={12} />
                    <span>Обзор...</span>
                  </button>
                </div>
              </div>
              <input
                type="text"
                value={modelPath}
                onChange={(e) => setModelPath(e.target.value)}
                placeholder="C:\Users\user\.0xagent\models\model.gguf"
                className="w-full px-3 py-2 rounded flat-input text-xs font-mono text-slate-100 placeholder-slate-500 focus:outline-none"
              />
            </div>

            {/* GGUF Model Metadata Card */}
            {modelMeta && (
              <div className="p-3 rounded-lg bg-slate-900/90 border border-emerald-500/30 text-xs space-y-1.5 font-mono">
                <div className="flex items-center justify-between text-emerald-300 font-bold border-b border-emerald-500/20 pb-1">
                  <span className="truncate">{modelMeta.architecture} ({modelMeta.modelName || 'GGUF'})</span>
                  <span className="px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-400 text-[10px]">
                    {modelMeta.fileSizeFormatted}
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Host, Port & Numerical Parameters */}
          <div className="p-4 rounded-xl glass-card border border-white/10 space-y-4">
            <div className="flex items-center justify-between border-b border-white/10 pb-2">
              <span className="text-xs font-semibold text-slate-200">Параметры производительности</span>
              <button
                type="button"
                onClick={handleApplyFastPreset}
                className="flat-btn px-2.5 py-1 rounded bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 text-[11px] font-semibold flex items-center gap-1 cursor-pointer transition-all shadow-sm"
              >
                <Zap size={12} />
                <span>⚡ Быстрый пресет (50+ t/s)</span>
              </button>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-[11px] font-medium text-slate-300">Host (IP-адрес)</label>
                <input
                  type="text"
                  value={host}
                  onChange={(e) => setHost(e.target.value)}
                  className="w-full px-3 py-1.5 rounded flat-input text-xs font-mono text-slate-100 focus:outline-none"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[11px] font-medium text-slate-300">Port (Порт)</label>
                <input
                  type="number"
                  value={port}
                  onChange={(e) => setPort(Number(e.target.value))}
                  className="w-full px-3 py-1.5 rounded flat-input text-xs font-mono text-slate-100 focus:outline-none"
                />
              </div>
            </div>

            {/* Context Size -c with quick presets */}
            <div className="space-y-1.5 pt-1">
              <div className="flex justify-between items-center text-xs">
                <label className="font-semibold text-slate-200">Размер контекста (-c)</label>
                <div className="flex gap-1">
                  {[4096, 8192, 16384, 32768, 65536].map((sz) => (
                    <button
                      key={sz}
                      type="button"
                      onClick={() => setCtxSize(sz)}
                      className={`px-1.5 py-0.5 rounded text-[10px] font-mono cursor-pointer transition-colors ${
                        ctxSize === sz ? 'bg-emerald-500/30 text-emerald-300 border border-emerald-500/40' : 'bg-slate-800 text-slate-400 hover:text-white'
                      }`}
                    >
                      {sz / 1024}k
                    </button>
                  ))}
                </div>
              </div>
              <input
                type="number"
                value={ctxSize}
                onChange={(e) => setCtxSize(Number(e.target.value))}
                className="w-full px-3 py-1.5 rounded flat-input text-xs font-mono text-slate-100 focus:outline-none"
              />
            </div>

            {/* GPU Layers & CPU Threads */}
            <div className="grid grid-cols-2 gap-3 pt-1">
              <div className="space-y-1">
                <label className="text-[11px] font-medium text-slate-300">GPU Layers (-ngl)</label>
                <input
                  type="number"
                  value={gpuLayers}
                  onChange={(e) => setGpuLayers(Number(e.target.value))}
                  className="w-full px-3 py-1.5 rounded flat-input text-xs font-mono text-slate-100 focus:outline-none"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[11px] font-medium text-slate-300">CPU Threads (-t)</label>
                <input
                  type="number"
                  value={threads}
                  onChange={(e) => setThreads(Number(e.target.value))}
                  className="w-full px-3 py-1.5 rounded flat-input text-xs font-mono text-slate-100 focus:outline-none"
                />
              </div>
            </div>

            {/* Batch & Micro-Batch */}
            <div className="grid grid-cols-2 gap-3 pt-1">
              <div className="space-y-1">
                <label className="text-[11px] font-medium text-slate-300">Batch Size (-b)</label>
                <input
                  type="number"
                  value={batchSize}
                  onChange={(e) => setBatchSize(Number(e.target.value))}
                  className="w-full px-3 py-1.5 rounded flat-input text-xs font-mono text-slate-100 focus:outline-none"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[11px] font-medium text-slate-300">Micro-Batch (-ub)</label>
                <input
                  type="number"
                  value={ubatchSize}
                  onChange={(e) => setUbatchSize(Number(e.target.value))}
                  className="w-full px-3 py-1.5 rounded flat-input text-xs font-mono text-slate-100 focus:outline-none"
                />
              </div>
            </div>

            {/* Temp, Min-P, Repeat Penalty, Top-K, Top-P, Max Tokens (Predict) */}
            <div className="grid grid-cols-3 gap-3 pt-1">
              <div className="space-y-1">
                <label className="text-[11px] font-medium text-slate-300">Temp (--temp)</label>
                <input
                  type="number"
                  step="0.05"
                  value={temp}
                  onChange={(e) => setTemp(Number(e.target.value))}
                  className="w-full px-3 py-1.5 rounded flat-input text-xs font-mono text-slate-100 focus:outline-none"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[11px] font-medium text-slate-300">Min-P (--min-p)</label>
                <input
                  type="number"
                  step="0.01"
                  value={minP}
                  onChange={(e) => setMinP(Number(e.target.value))}
                  className="w-full px-3 py-1.5 rounded flat-input text-xs font-mono text-slate-100 focus:outline-none"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[11px] font-medium text-slate-300">Repeat Penalty</label>
                <input
                  type="number"
                  step="0.05"
                  value={repeatPenalty}
                  onChange={(e) => setRepeatPenalty(Number(e.target.value))}
                  className="w-full px-3 py-1.5 rounded flat-input text-xs font-mono text-slate-100 focus:outline-none"
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3 pt-1">
              <div className="space-y-1">
                <label className="text-[11px] font-medium text-slate-300">Top-K (--top-k)</label>
                <input
                  type="number"
                  value={topK}
                  onChange={(e) => setTopK(Number(e.target.value))}
                  placeholder="40"
                  className="w-full px-3 py-1.5 rounded flat-input text-xs font-mono text-slate-100 focus:outline-none"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[11px] font-medium text-slate-300">Top-P (--top-p)</label>
                <input
                  type="number"
                  step="0.05"
                  value={topP}
                  onChange={(e) => setTopP(Number(e.target.value))}
                  placeholder="1"
                  className="w-full px-3 py-1.5 rounded flat-input text-xs font-mono text-slate-100 focus:outline-none"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[11px] font-medium text-slate-300">Макс. токенов (-n)</label>
                <input
                  type="number"
                  value={predict}
                  onChange={(e) => setPredict(Number(e.target.value))}
                  placeholder="4264"
                  className="w-full px-3 py-1.5 rounded flat-input text-xs font-mono text-slate-100 focus:outline-none"
                />
              </div>
            </div>

            {/* Parallel Slots & Cache Reuse */}
            <div className="grid grid-cols-2 gap-3 pt-1">
              <div className="space-y-1">
                <label className="text-[11px] font-medium text-slate-300">Параллельные слоты (--parallel)</label>
                <input
                  type="number"
                  value={parallelSlots}
                  onChange={(e) => setParallelSlots(Number(e.target.value))}
                  placeholder="2"
                  className="w-full px-3 py-1.5 rounded flat-input text-xs font-mono text-slate-100 focus:outline-none"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[11px] font-medium text-slate-300">Переиспользование кэша (--cache-reuse)</label>
                <input
                  type="number"
                  value={cacheReuse}
                  onChange={(e) => setCacheReuse(Number(e.target.value))}
                  placeholder="256"
                  className="w-full px-3 py-1.5 rounded flat-input text-xs font-mono text-slate-100 focus:outline-none"
                />
              </div>
            </div>

            {/* Slot Save Path */}
            <div className="space-y-1 pt-1">
              <div className="flex items-center justify-between">
                <label className="text-[11px] font-medium text-slate-300">Папка сохранения слотов (--slot-save-path)</label>
                <button
                  type="button"
                  onClick={handleSelectSlotSavePath}
                  className="text-[11px] text-sky-400 hover:text-sky-300 flex items-center gap-1 cursor-pointer font-normal"
                >
                  <Folder size={12} />
                  <span>Обзор...</span>
                </button>
              </div>
              <input
                type="text"
                value={slotSavePath}
                onChange={(e) => setSlotSavePath(e.target.value)}
                placeholder="C:\Users\user\.0xagent\slots"
                className="w-full px-3 py-1.5 rounded flat-input text-xs font-mono text-slate-100 placeholder-slate-500 focus:outline-none"
              />
            </div>

            {/* Extra CLI Arguments */}
            <div className="space-y-1 pt-1">
              <label className="text-[11px] font-medium text-slate-300">Дополнительные CLI флагов запуска (Custom Args)</label>
              <input
                type="text"
                value={customArgs}
                onChange={(e) => setCustomArgs(e.target.value)}
                placeholder="Например: --tensor-split 1,1 -ctk f16"
                className="w-full px-3 py-1.5 rounded flat-input text-xs font-mono text-slate-100 placeholder-slate-500 focus:outline-none"
              />
            </div>

            {/* Custom Pro Switches Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 pt-2 border-t border-white/10">
              {toggleItems.map((item, i) => (
                <div key={i} className="flex items-center justify-between p-2 rounded bg-slate-900/60 border border-white/5">
                  <span className="text-[11px] text-slate-300">{item.label}</span>
                  <div
                    onClick={item.toggle}
                    className={`w-8 h-4 rounded-full p-0.5 cursor-pointer transition-colors ${
                      item.value ? 'bg-emerald-500' : 'bg-slate-700'
                    }`}
                  >
                    <div
                      className={`w-3 h-3 rounded-full bg-white transition-transform ${
                        item.value ? 'translate-x-4' : 'translate-x-0'
                      }`}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Action Buttons: Start & Stop Server */}
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={handleStartServer}
              disabled={serverStatus === 'running'}
              className="flex-1 flat-btn py-3 rounded-xl text-xs font-bold text-emerald-400 hover:text-emerald-300 border border-emerald-500/40 bg-emerald-500/10 hover:bg-emerald-500/20 flex items-center justify-center gap-2 disabled:opacity-40 shadow-lg cursor-pointer transition-all"
            >
              <Play size={14} />
              <span>Запустить сервер llama.cpp</span>
            </button>
            <button
              type="button"
              onClick={handleStopServer}
              disabled={serverStatus !== 'running'}
              className="flex-1 flat-btn py-3 rounded-xl text-xs font-bold text-rose-400 hover:text-rose-300 border border-rose-500/40 bg-rose-500/10 hover:bg-rose-500/20 flex items-center justify-center gap-2 disabled:opacity-40 shadow-lg cursor-pointer transition-all"
            >
              <Square size={14} />
              <span>Остановить сервер</span>
            </button>
          </div>
        </div>

        {/* RIGHT COLUMN: Persistent Full-Height Server Logs Console Terminal (5/12) */}
        <div className="lg:col-span-5 h-full flex flex-col space-y-2 sticky top-4">
          <div className="glass-panel border border-[var(--theme-border)] rounded-xl overflow-hidden flex flex-col h-[650px] max-h-[calc(100vh-140px)] shadow-2xl">
            
            {/* Terminal Header Bar */}
            <div className="bg-slate-900/90 px-3.5 py-2.5 border-b border-white/10 flex flex-wrap items-center justify-between gap-2 select-none">
              <div className="flex items-center gap-2">
                <Terminal size={14} className="text-emerald-400 animate-pulse" />
                <span className="text-xs font-bold text-slate-100">Логи Сервера (llama-server.log)</span>
                {logFilePath && (
                  <span className="text-[10px] text-slate-400 font-mono hidden xl:inline" title={logFilePath}>
                    (~/.0xagent/logs)
                  </span>
                )}
              </div>

              {/* Console Action Buttons */}
              <div className="flex items-center gap-2 text-[11px]">
                <label className="flex items-center gap-1.5 cursor-pointer text-slate-300 hover:text-white select-none">
                  <input
                    type="checkbox"
                    checked={serverLogsAutoScroll}
                    onChange={(e) => setServerLogsAutoScroll(e.target.checked)}
                    className="rounded bg-slate-950 border-white/20 text-emerald-500 focus:ring-0"
                  />
                  <span>Auto-scroll</span>
                </label>

                <button
                  type="button"
                  onClick={handleCopyLogs}
                  className="px-2 py-1 rounded bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white flex items-center gap-1 transition-all cursor-pointer"
                  title="Копировать все логи"
                >
                  {isCopiedLogs ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
                  <span>{isCopiedLogs ? 'Скопировано!' : 'Копия'}</span>
                </button>

                <button
                  type="button"
                  onClick={handleDownloadLogs}
                  className="px-2 py-1 rounded bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white flex items-center gap-1 transition-all cursor-pointer"
                  title="Скачать файл логов"
                >
                  <FileText size={12} className="text-sky-400" />
                  <span>Файл</span>
                </button>

                <button
                  type="button"
                  onClick={() => setServerLogs([])}
                  className="px-2 py-1 rounded bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 font-medium cursor-pointer transition-all"
                  title="Очистить экран логов"
                >
                  Clear
                </button>
              </div>
            </div>

            {/* Terminal Body */}
            <div ref={logsContainerRef} className="flex-1 p-3.5 font-mono text-[11px] bg-slate-950/95 text-emerald-400 overflow-y-auto space-y-1.5 select-text scrollbar-thin rounded-b-xl">
              {serverLogs.length > 0 ? (
                serverLogs.map((log, index) => {
                  const isError = log.includes('[ERROR]') || log.includes('error') || log.includes('FAILED');
                  const isCmd = log.includes('[CMD]');
                  const isSystem = log.includes('[SYSTEM]') || log.includes('[WATCHDOG');
                  return (
                    <div
                      key={index}
                      className={`break-all leading-relaxed ${
                        isError
                          ? 'text-rose-400 font-bold bg-rose-950/30 p-1 rounded border border-rose-500/20'
                          : isCmd
                          ? 'text-sky-300 font-bold'
                          : isSystem
                          ? 'text-amber-300'
                          : 'text-emerald-400'
                      }`}
                    >
                      {log}
                    </div>
                  );
                })
              ) : (
                <div className="text-slate-500 italic p-4 text-center">
                  Логи сервера будут автоматически сохранены и отображены в этом окне при запуске llama-server.exe.
                </div>
              )}
              <div ref={logsEndRef} />
            </div>
          </div>
        </div>

      </div>

      {/* Model Picker Modal */}
      <ModelPickerModal
        isOpen={isPickerModalOpen}
        onClose={() => setIsPickerModalOpen(false)}
        onSelectModel={(selectedPath) => setModelPath(selectedPath)}
      />
    </div>
  );
};
