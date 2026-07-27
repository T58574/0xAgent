import React, { useState, useEffect } from 'react';
import { Cpu, Play, Square, Folder, Download, HardDrive, RefreshCw, AlertTriangle, Zap, Layers, Activity, Eye, Search, Trash2, CheckCircle2, Trash } from 'lucide-react';
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
  repeatPenalty: number;
  setRepeatPenalty: (val: number) => void;
  flashAttn: boolean;
  setFlashAttn: (val: boolean) => void;
  embedding: boolean;
  setEmbedding: (val: boolean) => void;
  contBatching: boolean;
  setContBatching: (val: boolean) => void;
  promptCache: boolean;
  setPromptCache: (val: boolean) => void;
  mlock: boolean;
  setMlock: (val: boolean) => void;
  mmap: boolean;
  setMmap: (val: boolean) => void;
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
  repeatPenalty,
  setRepeatPenalty,
  flashAttn,
  setFlashAttn,
  embedding,
  setEmbedding,
  contBatching,
  setContBatching,
  promptCache,
  setPromptCache,
  mlock,
  setMlock,
  mmap,
  setMmap,
  serverStatus,
  setServerStatus,
  serverLogs,
  setServerLogs,
  serverLogsAutoScroll,
  setServerLogsAutoScroll,
  setApiUrl,
}) => {
  const { showToast } = useToast();
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

  // 1. Initial Load: Hardware, Releases & Initial Server Status
  useEffect(() => {
    async function loadData() {
      try {
        setIsLoadingReleases(true);
        const [releases, installed, hw, statusInfo] = await Promise.all([
          api.get_llama_releases().catch(() => []),
          api.get_installed_llama_versions().catch(() => []),
          api.detect_hardware().catch(() => null),
          api.get_server_status().catch(() => null),
        ]);

        setGithubReleases(releases);
        setInstalledVersions(installed);
        setHardwareInfo(hw);

        if (statusInfo && statusInfo.running) {
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
    } catch (err) {
      console.error('Failed to refresh installed versions:', err);
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
      await refreshInstalledVersions();
      if (exePath.toLowerCase() === vExePath.toLowerCase()) {
        const updated = await api.get_installed_llama_versions();
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
        flashAttn,
        mmap,
        mlock,
        embedding,
        contBatching,
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
    <div className="space-y-5 font-sans text-slate-100 max-w-4xl">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold text-slate-200">Параметры сервера Llama.cpp</h3>
          <p className="text-xs text-slate-400 mt-0.5">
            Конфигурация локального движка выполнения GGUF моделей с GPU Offload
          </p>
        </div>

        {/* Live Slot & Health Metrics Badge */}
        {serverStatus === 'running' && (
          <div className="flex items-center gap-2 text-xs font-mono bg-slate-900/80 px-3 py-1.5 rounded border border-white/10 select-none">
            <Activity size={13} className={healthStatus === 'ok' ? 'text-emerald-400 animate-pulse' : 'text-amber-400 animate-spin'} />
            <span>
              {healthStatus === 'loading'
                ? 'Загрузка модели в память...'
                : healthStatus === 'ok'
                ? `Готов | Слоты: ${slotMetrics.activeSlots}/${slotMetrics.totalSlots || 4}`
                : 'Ожидание...'}
            </span>
          </div>
        )}
      </div>

      {/* Crash Advisory Alert Box */}
      {crashAdvice && (
        <div className="p-3 rounded-md bg-amber-500/10 border border-amber-500/40 text-amber-300 text-xs flex items-start gap-2 animate-fadeIn">
          <AlertTriangle size={15} className="shrink-0 mt-0.5" />
          <span>{crashAdvice}</span>
        </div>
      )}

      {/* Hardware GPU Status Banner (No extra buttons, 100% Full GPU Offload default) */}
      {hardwareInfo && hardwareInfo.isAutoDetected && (
        <div className="p-3 rounded-xl bg-slate-900/80 border border-emerald-500/30 flex items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-400">
              <Zap size={15} />
            </div>
            <div>
              <div className="flex items-center gap-2 font-semibold text-slate-200">
                <span>Видеокарта:</span>
                <span className="text-emerald-300 font-mono">{hardwareInfo.gpuName}</span>
                <span className="px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-mono text-[10px]">
                  100% Full GPU Offload (-ngl 999)
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* GitHub Releases Llama.cpp Installer & Installed Versions Manager Card */}
      <div className="p-4 rounded-md glass-card border border-white/10 space-y-4">
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
                    {rel.tag} ({rel.name})
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-[11px] font-medium text-slate-300">
                Сборка / Бинарник (Build Variant)
              </label>
              <select
                value={selectedAssetUrl}
                onChange={(e) => {
                  setSelectedAssetUrl(e.target.value);
                  const a = currentRel?.assets.find((ast: any) => ast.download_url === e.target.value);
                  if (a) setSelectedAssetName(a.name);
                }}
                disabled={!currentRel || isInstallingLlama}
                className="w-full px-3 py-1.5 rounded flat-input text-xs font-mono text-slate-100 focus:outline-none cursor-pointer"
              >
                {currentRel?.assets.map((ast: any) => (
                  <option key={ast.download_url} value={ast.download_url} className="bg-slate-900 text-slate-100">
                    {ast.name} ({ast.size})
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2 pt-1">
            <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={autoCleanupOld}
                onChange={(e) => setAutoCleanupOld(e.target.checked)}
                className="rounded bg-slate-900 border-white/20 text-emerald-500 focus:ring-0 focus:ring-offset-0 cursor-pointer"
              />
              <span>Автоочистка старых версий (удалять предыдущие при скачивании новой)</span>
            </label>

            <div className="flex items-center gap-2 shrink-0">
              {/* Inline Download Success Animated Badge */}
              {justDownloadedTag === selectedTag && (
                <div className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-emerald-500/20 border border-emerald-500/50 text-emerald-300 text-xs font-semibold animate-pulse shadow-lg shadow-emerald-950/50">
                  <CheckCircle2 size={15} className="text-emerald-400 shrink-0" />
                  <span>Скачано и установлено!</span>
                </div>
              )}

              <button
                type="button"
                onClick={handleInstallSelectedLlamaVersion}
                disabled={isInstallingLlama || !selectedTag}
                className="flat-btn px-4 py-2 rounded text-xs font-medium text-emerald-400 border-emerald-500/40 hover:bg-emerald-500/10 cursor-pointer flex items-center gap-2 disabled:opacity-50"
              >
                {isInstallingLlama ? <RefreshCw size={13} className="animate-spin" /> : <HardDrive size={13} />}
                <span>
                  {isInstallingLlama
                    ? 'Установка...'
                    : isSelectedVersionInstalled
                    ? `Переключить / Выбрать установленную ${selectedTag}`
                    : `Скачать и установить ${selectedTag} с GitHub`}
                </span>
              </button>
            </div>
          </div>
        </div>

        {/* Installed Versions Retention List */}
        {installedVersions.length > 0 && (
          <div className="space-y-2">
            <div className="text-[11px] font-medium text-slate-300 flex items-center justify-between">
              <span>Сохраненные локально версии llama.cpp (Без повторного скачивания):</span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleCleanupOldVersions}
                  disabled={isCleaningOld}
                  className="text-[11px] text-rose-400 hover:text-rose-300 cursor-pointer flex items-center gap-1 hover:underline disabled:opacity-50"
                  title="Удалить все предыдущие версии кроме текущей активной"
                >
                  {isCleaningOld ? <RefreshCw size={11} className="animate-spin" /> : <Trash size={11} />}
                  <span>Очистить старые версии</span>
                </button>
                <button
                  type="button"
                  onClick={refreshInstalledVersions}
                  className="text-slate-400 hover:text-white cursor-pointer ml-1"
                  title="Обновить список"
                >
                  <RefreshCw size={11} />
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {installedVersions.map((item) => (
                <div
                  key={item.exePath}
                  className={`p-2.5 rounded border text-xs flex items-center justify-between gap-2 transition-all ${
                    item.isCurrent
                      ? 'border-emerald-500/50 bg-emerald-500/10 text-emerald-300 font-medium'
                      : 'border-white/10 bg-slate-900/40 text-slate-300'
                  }`}
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <span className="font-mono font-bold text-xs">[{item.tag}]</span>
                      {item.isCurrent && (
                        <span className="text-[10px] px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                          Активная
                        </span>
                      )}
                    </div>
                    <div className="text-[10px] text-slate-400 font-mono truncate mt-0.5" title={item.exePath}>
                      {item.exePath}
                    </div>
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    {!item.isCurrent && (
                      <button
                        type="button"
                        onClick={() => handleSelectInstalledVersion(item.exePath)}
                        className="flat-btn px-2 py-1 rounded text-[11px] font-medium text-slate-200 hover:text-white border-white/20 shrink-0 cursor-pointer"
                      >
                        Выбрать
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => handleDeleteInstalledVersion(item.tag, item.exePath)}
                      disabled={deletingTag === item.tag}
                      className="p-1.5 rounded text-rose-400 hover:text-rose-200 hover:bg-rose-500/20 border border-transparent hover:border-rose-500/30 shrink-0 cursor-pointer transition-colors disabled:opacity-50"
                      title={item.isCurrent ? 'Удалить текущую сборку (будет автоматически переключена другая)' : `Удалить сборку [${item.tag}]`}
                    >
                      {deletingTag === item.tag ? <RefreshCw size={12} className="animate-spin" /> : <Trash2 size={12} />}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

      </div>

      {/* Executable & Model Files Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-slate-300">
            Исполняемый файл (llama-server.exe)
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              value={exePath}
              onChange={(e) => setExePath(e.target.value)}
              placeholder="C:\llama-server.exe"
              className="flex-1 px-3 py-2 rounded-md flat-input text-xs font-mono text-slate-100 focus:outline-none"
            />
            <button
              type="button"
              onClick={handleSelectExe}
              className="flat-btn px-2.5 py-2 text-xs font-medium rounded-md text-slate-200 hover:text-white cursor-pointer shrink-0"
              title="Выбрать файл llama-server.exe"
            >
              <Folder size={13} />
            </button>
          </div>
        </div>

        <div className="md:col-span-2 space-y-1.5">
          <label className="text-xs font-medium text-slate-300 flex items-center justify-between">
            <span>Файл GGUF Модели (.gguf)</span>
            <button
              type="button"
              onClick={() => setIsPickerModalOpen(true)}
              className="text-[11px] text-emerald-400 hover:underline cursor-pointer flex items-center gap-1 font-sans"
            >
              <Search size={11} />
              <span>Сканировать папку моделей...</span>
            </button>
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              value={modelPath}
              onChange={(e) => setModelPath(e.target.value)}
              placeholder="C:\models\model.gguf"
              className="flex-1 px-3 py-2 rounded-md flat-input text-xs font-mono text-slate-100 focus:outline-none"
            />
            <button
              type="button"
              onClick={handleSelectModel}
              className="flat-btn px-2.5 py-2 text-xs font-medium rounded-md text-slate-200 hover:text-white cursor-pointer shrink-0"
              title="Выбрать файл .gguf"
            >
              <Folder size={13} />
            </button>
          </div>
        </div>
      </div>

      {/* GGUF Parsed Metadata Card */}
      {modelMeta && (
        <div className={`p-3.5 rounded-md border text-xs space-y-2 animate-fadeIn ${
          modelMeta.isMmproj ? 'border-amber-500/40 bg-amber-500/10 text-amber-200' : 'border-emerald-500/40 bg-emerald-500/10 text-slate-200'
        }`}>
          {modelMeta.isMmproj ? (
            <div className="flex items-center gap-2 text-amber-300 font-semibold text-xs">
              <Eye size={15} />
              <span>Выбранный файл является Vision-проектором (mmproj), а не основной моделью LLM!</span>
            </div>
          ) : (
            <div className="flex items-center justify-between">
              <div className="font-semibold text-emerald-300 flex items-center gap-1.5">
                <Cpu size={14} />
                <span>Метаданные модели: {modelMeta.modelName}</span>
              </div>
              <span className="font-mono text-[11px] text-slate-300">{modelMeta.fileSizeFormatted}</span>
            </div>
          )}

          <div className="flex flex-wrap items-center gap-2 pt-1 font-mono text-[11px]">
            <span className="px-2 py-0.5 rounded bg-slate-900 border border-white/10 text-sky-300 font-bold uppercase">
              Архитектура: {modelMeta.architecture}
            </span>
            <span className="px-2 py-0.5 rounded bg-slate-900 border border-white/10 text-emerald-300 font-bold">
              Квант: {modelMeta.quantization}
            </span>
            {modelMeta.blockCount > 0 && (
              <span className="px-2 py-0.5 rounded bg-slate-900 border border-white/10 text-slate-200 flex items-center gap-1">
                <Layers size={11} className="text-emerald-400" />
                <span>{modelMeta.blockCount} слоев</span>
              </span>
            )}
            {modelMeta.contextLength > 0 && (
              <span className="px-2 py-0.5 rounded bg-slate-900 border border-white/10 text-slate-200">
                Макс. контекст: {modelMeta.contextLength.toLocaleString()} токенов
              </span>
            )}
            {modelMeta.expertCount > 0 && (
              <span className="px-2 py-0.5 rounded bg-slate-900 border border-white/10 text-purple-300 font-bold">
                MoE: {modelMeta.expertCount} экспертов
              </span>
            )}
          </div>
        </div>
      )}

      {/* Host & Port */}
      <div className="space-y-1.5">
        <label className="text-xs font-medium text-slate-300">
          Хост и Порт локального сервера
        </label>
        <div className="flex gap-2">
          <input
            type="text"
            value={host}
            onChange={(e) => setHost(e.target.value)}
            placeholder="127.0.0.1"
            className="w-1/2 px-3 py-2 rounded-md flat-input text-xs font-mono text-slate-100 focus:outline-none"
          />
          <input
            type="number"
            value={port}
            onChange={(e) => setPort(Number(e.target.value))}
            placeholder="11434"
            className="w-1/2 px-3 py-2 rounded-md flat-input text-xs font-mono text-slate-100 focus:outline-none"
          />
        </div>
      </div>

      {/* Numerical Parameters Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-3.5 rounded-md glass-card">
        <div>
          <div className="flex justify-between items-center text-[11px]">
            <label className="font-medium text-slate-300">Context Size (-c)</label>
            {modelMeta && modelMeta.contextLength > 0 && (
              <span className="text-[10px] text-slate-400 font-mono" title="Обученный размер контекста GGUF модели">
                Обучен: {modelMeta.contextLength.toLocaleString()}
              </span>
            )}
          </div>
          <input
            type="number"
            value={ctxSize}
            onChange={(e) => setCtxSize(Number(e.target.value))}
            placeholder="Введит контекст (напр. 8192)..."
            className="w-full mt-1 px-2.5 py-1.5 rounded-md flat-input text-xs font-mono"
          />
          <div className="flex flex-wrap gap-1 mt-1.5">
            {[4096, 8192, 16384, 32768, 65536, 131072].map((val) => (
              <button
                key={val}
                type="button"
                onClick={() => setCtxSize(val)}
                className={`px-1.5 py-0.5 rounded text-[10px] font-mono cursor-pointer transition-colors ${
                  ctxSize === val
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 font-bold'
                    : 'bg-slate-900/60 text-slate-400 border border-white/5 hover:text-slate-200'
                }`}
              >
                {val >= 1024 ? `${val / 1024}K` : val}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="text-[11px] font-medium text-slate-300">CPU Threads (-t)</label>
          <input
            type="number"
            value={threads}
            onChange={(e) => setThreads(Number(e.target.value))}
            className="w-full mt-1 px-2.5 py-1.5 rounded-md flat-input text-xs font-mono"
          />
        </div>

        <div>
          <div className="flex justify-between items-center text-[11px]">
            <label className="font-medium text-slate-300">GPU Offload (-ngl)</label>
            {modelMeta && modelMeta.blockCount > 0 && (
              <button
                type="button"
                onClick={() => setGpuLayers(modelMeta.blockCount)}
                className="text-[10px] text-emerald-400 hover:underline cursor-pointer font-mono"
              >
                Все {modelMeta.blockCount} слоев
              </button>
            )}
          </div>
          <input
            type="number"
            value={gpuLayers}
            onChange={(e) => setGpuLayers(Number(e.target.value))}
            className="w-full mt-1 px-2.5 py-1.5 rounded-md flat-input text-xs font-mono"
          />
        </div>

        <div>
          <label className="text-[11px] font-medium text-slate-300">Batch Size (-b)</label>
          <input
            type="number"
            value={batchSize}
            onChange={(e) => setBatchSize(Number(e.target.value))}
            className="w-full mt-1 px-2.5 py-1.5 rounded-md flat-input text-xs font-mono"
          />
        </div>

        <div>
          <label className="text-[11px] font-medium text-slate-300">Micro-Batch (-ub)</label>
          <input
            type="number"
            value={ubatchSize}
            onChange={(e) => setUbatchSize(Number(e.target.value))}
            className="w-full mt-1 px-2.5 py-1.5 rounded-md flat-input text-xs font-mono"
          />
        </div>

        <div>
          <label className="text-[11px] font-medium text-slate-300">Temperature</label>
          <input
            type="number"
            step="0.05"
            value={temp}
            onChange={(e) => setTemp(Number(e.target.value))}
            className="w-full mt-1 px-2.5 py-1.5 rounded-md flat-input text-xs font-mono"
          />
        </div>

        <div>
          <label className="text-[11px] font-medium text-slate-300">Min P</label>
          <input
            type="number"
            step="0.01"
            value={minP}
            onChange={(e) => setMinP(Number(e.target.value))}
            className="w-full mt-1 px-2.5 py-1.5 rounded-md flat-input text-xs font-mono"
          />
        </div>

        <div>
          <label className="text-[11px] font-medium text-slate-300">Repeat Penalty</label>
          <input
            type="number"
            step="0.05"
            value={repeatPenalty}
            onChange={(e) => setRepeatPenalty(Number(e.target.value))}
            className="w-full mt-1 px-2.5 py-1.5 rounded-md flat-input text-xs font-mono"
          />
        </div>
      </div>

      {/* Pro Custom Toggle Switches Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5 select-none">
        {toggleItems.map((item, idx) => (
          <div
            key={idx}
            onClick={item.toggle}
            className="p-3 rounded-md glass-card flex items-center justify-between border border-white/10 cursor-pointer hover:border-white/20 transition-colors"
          >
            <span className="text-xs font-medium text-slate-300">{item.label}</span>
            <div
              className={`w-9 h-5 flex items-center rounded-full p-0.5 transition-colors duration-200 ${
                item.value ? 'bg-emerald-500 justify-end' : 'bg-slate-700 justify-start'
              }`}
            >
              <div className="w-3.5 h-3.5 rounded-full bg-white shadow-md" />
            </div>
          </div>
        ))}
      </div>

      {/* Start / Stop Server Triggers */}
      <div className="flex gap-3 pt-1">
        <button
          type="button"
          onClick={handleStartServer}
          disabled={serverStatus === 'running'}
          className="flex-1 flat-btn py-2.5 rounded-md text-xs font-medium text-emerald-400 hover:text-emerald-300 border-emerald-500/30 flex items-center justify-center gap-2 disabled:opacity-40"
        >
          <Play size={13} />
          <span>Запустить сервер llama.cpp</span>
        </button>
        <button
          type="button"
          onClick={handleStopServer}
          disabled={serverStatus !== 'running'}
          className="flex-1 flat-btn py-2.5 rounded-md text-xs font-medium text-rose-400 hover:text-rose-300 border-rose-500/30 flex items-center justify-center gap-2 disabled:opacity-40"
        >
          <Square size={13} />
          <span>Остановить сервер</span>
        </button>
      </div>

      {/* Server Console Output */}
      <div className="border border-white/10 rounded-md bg-slate-950/90 overflow-hidden flex flex-col">
        <div className="bg-slate-900/80 px-3 py-2 flex justify-between items-center text-xs text-slate-400 select-none border-b border-white/5">
          <span className="flex items-center gap-1.5 font-medium text-emerald-400">
            <Cpu size={13} />
            <span>Логи сервера</span>
          </span>
          <div className="flex gap-3 text-[11px]">
            <label className="flex items-center gap-1 cursor-pointer">
              <input
                type="checkbox"
                checked={serverLogsAutoScroll}
                onChange={(e) => setServerLogsAutoScroll(e.target.checked)}
                className="rounded bg-slate-800 border-white/10 text-xs"
              />
              <span>Auto scroll</span>
            </label>
            <button
              type="button"
              onClick={() => setServerLogs([])}
              className="hover:text-white font-medium cursor-pointer"
            >
              Clear
            </button>
          </div>
        </div>
        <div className="p-3 font-mono text-[11px] text-emerald-400 h-28 overflow-y-auto space-y-1 leading-tight select-text scrollbar-none">
          {serverLogs.length > 0 ? (
            serverLogs.map((log, index) => (
              <div key={index} className="break-all">{log}</div>
            ))
          ) : (
            <div className="text-slate-500 italic">Логи сервера появятся здесь при запуске.</div>
          )}
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
