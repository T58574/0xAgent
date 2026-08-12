import React, { useState, useEffect, useRef } from 'react';
import { Cpu, Play, Square, Folder, AlertTriangle, Zap, Activity } from 'lucide-react';
import { GgufMetadata, HardwareInfo } from '../../types';
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

  // Metadata, Hardware, Slots, Modal, Adviser
  const [modelMeta, setModelMeta] = useState<GgufMetadata | null>(null);
  const [hardwareInfo, setHardwareInfo] = useState<HardwareInfo | null>(null);
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
        .then((meta) => setModelMeta(meta))
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

      {/* MAIN 2-COLUMN GRID LAYOUT */}
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

          {/* GitHub Releases Llama.cpp Installer Section */}
          <div className="space-y-4">
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
                <button
                  type="button"
                  onClick={handleSelectModel}
                  className="text-[11px] text-sky-400 hover:text-sky-300 flex items-center gap-1 cursor-pointer font-normal"
                >
                  <Folder size={12} />
                  <span>Обзор...</span>
                </button>
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
            onSelectSlotSavePath={handleSelectSlotSavePath}
            onApplyFastPreset={handleApplyFastPreset}
          />

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

        {/* RIGHT COLUMN: Terminal Logs Console */}
        <div className="lg:col-span-5 h-full flex flex-col space-y-2 sticky top-4">
          <ServerLogsConsole
            serverLogs={serverLogs}
            logFilePath={logFilePath}
            serverLogsAutoScroll={serverLogsAutoScroll}
            setServerLogsAutoScroll={setServerLogsAutoScroll}
            isCopiedLogs={isCopiedLogs}
            onCopyLogs={handleCopyLogs}
            onDownloadLogs={handleDownloadLogs}
            onClearLogs={() => setServerLogs([])}
            logsContainerRef={logsContainerRef}
            logsEndRef={logsEndRef}
          />
        </div>

      </div>
    </div>
  );
};
