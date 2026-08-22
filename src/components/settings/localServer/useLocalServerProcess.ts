import { useState, useEffect, useCallback } from 'react';
import { GgufMetadata, HardwareInfo, LocalModelItem } from '../../../types';
import * as api from '../../../services/api';
import { useToast } from '../../../context/ToastContext';
import { useI18n } from '../../../i18n';

export interface UseLocalServerProcessProps {
  exePath: string;
  setExePath: (val: string) => void;
  modelPath: string;
  setModelPath: (val: string) => void;
  host: string;
  port: number;
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
  repeatPenalty: number;
  setRepeatPenalty: (val: number) => void;
  flashAttn: boolean;
  setFlashAttn: (val: boolean) => void;
  mmap: boolean;
  mlock: boolean;
  embedding: boolean;
  contBatching: boolean;
  promptCache: boolean;
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
}

export function useLocalServerProcess(props: UseLocalServerProcessProps) {
  const {
    exePath,
    setExePath,
    modelPath,
    setModelPath,
    host,
    port,
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
    repeatPenalty,
    setRepeatPenalty,
    flashAttn,
    setFlashAttn,
    mmap,
    mlock,
    embedding,
    contBatching,
    promptCache,
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
  } = props;

  const { t } = useI18n();
  const { showToast } = useToast();

  const [logFilePath, setLogFilePath] = useState<string>('');
  const [isCopiedLogs, setIsCopiedLogs] = useState(false);
  const [isInstallingLlama, setIsInstallingLlama] = useState(false);
  const [githubReleases, setGithubReleases] = useState<any[]>([]);
  const [selectedTag, setSelectedTag] = useState<string>('');
  const [selectedAssetUrl, setSelectedAssetUrl] = useState<string>('');
  const [selectedAssetName, setSelectedAssetName] = useState<string>('');
  const [installedVersions, setInstalledVersions] = useState<{ tag: string; exePath: string; isCurrent: boolean }[]>([]);
  const [isLoadingReleases, setIsLoadingReleases] = useState(false);
  const [autoCleanupOld, setAutoCleanupOld] = useState(true);
  const [justDownloadedTag, setJustDownloadedTag] = useState<string | null>(null);
  const [isCleaningOld, setIsCleaningOld] = useState(false);
  const [deletingTag, setDeletingTag] = useState<string | null>(null);
  const [modelMeta, setModelMeta] = useState<GgufMetadata | null>(null);
  const [hardwareInfo, setHardwareInfo] = useState<HardwareInfo | null>(null);
  const [healthStatus, setHealthStatus] = useState<'ok' | 'loading' | 'stopped'>('stopped');
  const [slotMetrics, setSlotMetrics] = useState<{ totalSlots: number; activeSlots: number }>({ totalSlots: 0, activeSlots: 0 });
  const [crashAdvice, setCrashAdvice] = useState<string | null>(null);
  const [scannedLocalModels, setScannedLocalModels] = useState<LocalModelItem[]>([]);
  const [isActionLoading, setIsActionLoading] = useState(false);

  const refreshScannedModels = useCallback(async () => {
    try {
      const res = await api.get_available_models();
      if (res && res.local) {
        setScannedLocalModels(res.local);
      }
    } catch (err) {
      console.error('Failed to scan local models:', err);
    }
  }, []);

  const refreshInstalledVersions = useCallback(async () => {
    try {
      const list = await api.get_installed_llama_versions();
      setInstalledVersions(list);
      return list;
    } catch (err) {
      console.error('Failed to refresh installed versions:', err);
      return [];
    }
  }, []);

  // Initial Data Load
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
  }, [setServerLogs, setServerStatus]);

  // Parse GGUF Metadata on modelPath change
  useEffect(() => {
    if (modelPath && modelPath.trim().length > 0) {
      api.parse_gguf(modelPath.trim())
        .then((meta) => setModelMeta(meta))
        .catch(() => setModelMeta(null));
    } else {
      setModelMeta(null);
    }
  }, [modelPath]);

  // Health & Slots Polling
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

  // Crash Adviser Heuristics
  useEffect(() => {
    const logsStr = serverLogs.join('\n');
    if (logsStr.includes('check_tensor_dims: tensor \'output.weight\'')) {
      setCrashAdvice('Советчик: Драфт-модель имеет несовпадающий размер словаря. Для официального llama.cpp используйте совместимые драфт-модели с полным словарем (например, Qwen3.8-0.5B/1.5B) либо отключите спекулятивное декодирование.');
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

  // WebSocket Server Listeners
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
  }, [setServerLogs, setServerStatus]);

  const handleTagChange = useCallback((tag: string) => {
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
  }, [githubReleases, hardwareInfo]);

  const handleSelectExe = useCallback(async () => {
    try {
      const file = await api.select_file_native('Executable Files (*.exe)|*.exe|All Files (*.*)|*.*');
      if (file) setExePath(file);
    } catch (err) {
      console.error('Failed to select file:', err);
    }
  }, [setExePath]);

  const handleSelectModel = useCallback(async () => {
    try {
      const file = await api.select_file_native('GGUF Model Files (*.gguf)|*.gguf|All Files (*.*)|*.*');
      if (file) setModelPath(file);
    } catch (err) {
      console.error('Failed to select GGUF model:', err);
    }
  }, [setModelPath]);

  const handleSelectDraftModel = useCallback(async () => {
    try {
      const file = await api.select_file_native('GGUF Draft/MTP Files (*.gguf)|*.gguf|All Files (*.*)|*.*');
      if (file) setSpecDraftModel(file);
    } catch (err) {
      console.error('Failed to select Draft/MTP model:', err);
    }
  }, [setSpecDraftModel]);

  const handleSelectSlotSavePath = useCallback(async () => {
    try {
      const folder = await api.select_workspace();
      if (folder) setSlotSavePath(folder);
    } catch (err) {
      console.error('Failed to select slot save folder:', err);
    }
  }, [setSlotSavePath]);

  const handleInstallSelectedLlamaVersion = useCallback(async () => {
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
  }, [selectedTag, selectedAssetUrl, selectedAssetName, autoCleanupOld, setExePath, refreshInstalledVersions, showToast]);

  const handleSelectInstalledVersion = useCallback(async (vExePath: string) => {
    try {
      const res = await api.select_installed_llama(vExePath);
      setExePath(res.exePath);
      await refreshInstalledVersions();
      showToast(res.message || 'Активная версия переключена!', 'success');
    } catch (err: any) {
      showToast(`Ошибка переключения: ${err.message || err}`, 'error');
    }
  }, [setExePath, refreshInstalledVersions, showToast]);

  const handleDeleteInstalledVersion = useCallback(async (tag: string, vExePath: string) => {
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
  }, [exePath, setExePath, refreshInstalledVersions, showToast]);

  const handleCleanupOldVersions = useCallback(async () => {
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
  }, [selectedTag, refreshInstalledVersions, showToast]);

  const handleClearLogs = useCallback(() => {
    setServerLogs([]);
  }, [setServerLogs]);

  const handleDownloadLogs = useCallback(() => {
    const text = serverLogs.join('\n');
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'llama-server.log';
    a.click();
    URL.revokeObjectURL(url);
  }, [serverLogs]);

  const handleCopyLogs = useCallback(() => {
    navigator.clipboard.writeText(serverLogs.join('\n'));
    setIsCopiedLogs(true);
    setTimeout(() => setIsCopiedLogs(false), 2000);
  }, [serverLogs]);

  const handleApplyFastPreset = useCallback(() => {
    setGpuLayers(99);
    setThreads(0);
    setBatchSize(2048);
    setUbatchSize(512);
    setFlashAttn(true);
    setParallelSlots(1);
    setCacheReuse(256);
    setCtxSize(16384);
    setCustomArgs('-ctk q8_0 -ctv q8_0');
    showToast(t.settings.localServer.fastPresetApplied, 'success');
  }, [setGpuLayers, setThreads, setBatchSize, setUbatchSize, setFlashAttn, setParallelSlots, setCacheReuse, setCtxSize, setCustomArgs, showToast, t]);

  const handleApplyFastMtpPreset = useCallback(() => {
    setSpecType('default');
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
    setTopK(20);
    setTopP(0.95);
    setTemp(1.0);
    setMinP(0.05);
    setRepeatPenalty(1.0);
    setParallelSlots(1);
    setCtxSize(32768);

    const draftModel = scannedLocalModels.find((m) => m.isDraft || /qwen3.*draft|draft.*qwen3/i.test(m.fileName));
    if (draftModel) {
      setSpecDraftModel(draftModel.filePath);
    }
    showToast(t.settings.localServer.fastMtpPresetApplied, 'success');
  }, [setSpecType, setSpecDraftNMax, setSpecDraftNgl, setSpecDraftPMin, setJinja, setReasoningPreserve, setReasoningFormat, setGpuLayers, setThreads, setBatchSize, setUbatchSize, setFlashAttn, setTopK, setTopP, setTemp, setMinP, setRepeatPenalty, setParallelSlots, setCtxSize, scannedLocalModels, setSpecDraftModel, showToast, t]);

  const handleStartLocalServer = useCallback(async () => {
    if (!modelPath) {
      showToast(t.settings.localServer.selectGgufToStart, 'error');
      return;
    }
    setIsActionLoading(true);
    try {
      const res = await api.start_local_server({
        exePath,
        modelPath,
        host,
        port,
        ctxSize,
        threads,
        gpuLayers,
        temp,
        batchSize,
        ubatchSize,
        minP,
        topK,
        topP,
        predict,
        repeatPenalty,
        flashAttn,
        mmap,
        mlock,
        embedding,
        contBatching,
        promptCache,
        parallelSlots,
        cacheReuse,
        slotSavePath,
        customArgs,
        specDraftModel,
        specType,
        specDraftNgl,
        specDraftNMax,
        specDraftPMin,
        jinja,
        reasoningPreserve,
        reasoningFormat,
      });
      if (res && res.success) {
        setServerStatus('running');
        showToast(t.settings.localServer.serverStartedSuccess, 'success');
      } else {
        showToast((res && res.message) || 'Server start failed', 'error');
      }
    } catch (err: any) {
      showToast(err.message || 'Failed to start server', 'error');
    } finally {
      setIsActionLoading(false);
    }
  }, [modelPath, exePath, host, port, ctxSize, threads, gpuLayers, temp, batchSize, ubatchSize, minP, topK, topP, predict, repeatPenalty, flashAttn, mmap, mlock, embedding, contBatching, promptCache, parallelSlots, cacheReuse, slotSavePath, customArgs, specDraftModel, specType, specDraftNgl, specDraftNMax, specDraftPMin, jinja, reasoningPreserve, reasoningFormat, setServerStatus, showToast, t]);

  const handleStopLocalServer = useCallback(async () => {
    setIsActionLoading(true);
    try {
      await api.stop_local_server();
      setServerStatus('stopped');
      showToast(t.settings.localServer.serverStoppedSuccess, 'info');
    } catch (err: any) {
      showToast(err.message || 'Failed to stop server', 'error');
    } finally {
      setIsActionLoading(false);
    }
  }, [setServerStatus, showToast, t]);

  const handleRestartLocalServer = useCallback(async () => {
    setIsActionLoading(true);
    try {
      await api.stop_local_server();
      await new Promise((r) => setTimeout(r, 600));
      await handleStartLocalServer();
    } catch (err: any) {
      showToast(err.message || 'Failed to restart server', 'error');
    } finally {
      setIsActionLoading(false);
    }
  }, [handleStartLocalServer, showToast]);

  return {
    logFilePath,
    isCopiedLogs,
    isInstallingLlama,
    githubReleases,
    selectedTag,
    selectedAssetUrl,
    selectedAssetName,
    setSelectedAssetUrl,
    setSelectedAssetName,
    installedVersions,
    isLoadingReleases,
    autoCleanupOld,
    setAutoCleanupOld,
    justDownloadedTag,
    isCleaningOld,
    deletingTag,
    modelMeta,
    hardwareInfo,
    healthStatus,
    slotMetrics,
    crashAdvice,
    scannedLocalModels,
    isActionLoading,
    refreshScannedModels,
    refreshInstalledVersions,
    handleTagChange,
    handleSelectExe,
    handleSelectModel,
    handleSelectDraftModel,
    handleSelectSlotSavePath,
    handleInstallSelectedLlamaVersion,
    handleSelectInstalledVersion,
    handleDeleteInstalledVersion,
    handleCleanupOldVersions,
    handleClearLogs,
    handleDownloadLogs,
    handleCopyLogs,
    handleApplyFastPreset,
    handleApplyFastMtpPreset,
    handleStartLocalServer,
    handleStopLocalServer,
    handleRestartLocalServer,
  };
}
