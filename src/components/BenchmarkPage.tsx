import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Activity,
  Play,
  CheckCircle2,
  XCircle,
  Clock,
  Zap,
  Cpu,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  Sliders,
  CheckSquare,
  Square,
  Sparkles,
  Layers,
  Terminal,
} from 'lucide-react';
import {
  AppConfig,
  BenchmarkTaskInfo,
  BenchmarkSuiteReport,
  BenchmarkTestResult,
  BenchmarkCategory,
} from '../types';
import * as api from '../services/api';
import { useToast } from '../context/ToastContext';

interface BenchmarkPageProps {
  config: AppConfig | null;
}

const CATEGORY_LABELS: Record<BenchmarkCategory, { label: string; color: string }> = {
  reasoning: { label: 'Рассуждения', color: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20' },
  coding: { label: 'Кодинг', color: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' },
  instruction_following: { label: 'IFEval / Запреты', color: 'bg-amber-500/10 text-amber-400 border-amber-500/20' },
  structured_data: { label: 'JSON / Схемы', color: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20' },
  agentic: { label: 'Агентский вызов', color: 'bg-purple-500/10 text-purple-400 border-purple-500/20' },
  retrieval: { label: 'Внимание (Needle)', color: 'bg-blue-500/10 text-blue-400 border-blue-500/20' },
  language: { label: 'Русский язык', color: 'bg-rose-500/10 text-rose-400 border-rose-500/20' },
  performance: { label: 'Скорость / TTFT', color: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20' },
};

export const BenchmarkPage: React.FC<BenchmarkPageProps> = React.memo(({ config }) => {
  const { showToast } = useToast();

  const [tasks, setTasks] = useState<BenchmarkTaskInfo[]>([]);
  const [selectedTaskIds, setSelectedTaskIds] = useState<string[]>([]);
  const [provider, setProvider] = useState<'local' | 'antigravity' | 'openai'>('local');
  const [modelName, setModelName] = useState<string>('');
  const [customEndpoint, setCustomEndpoint] = useState<string>('http://127.0.0.1:8080/v1');

  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [currentProgress, setCurrentProgress] = useState<{
    taskId: string;
    taskIndex: number;
    totalTasks: number;
  } | null>(null);

  const [report, setReport] = useState<BenchmarkSuiteReport | null>(null);
  const [expandedTasks, setExpandedTasks] = useState<Record<string, boolean>>({});

  // Initialize defaults from config
  useEffect(() => {
    if (config?.model_name) {
      setModelName(config.model_name);
    } else {
      setModelName('local:qwen2.5-coder-32b.gguf');
    }

    if (config?.local_server) {
      const host = config.local_server.host || '127.0.0.1';
      const port = config.local_server.port || 8080;
      setCustomEndpoint(`http://${host}:${port}/v1`);
    } else if (config?.api_url) {
      setCustomEndpoint(config.api_url);
    }
  }, [config]);

  // Load available benchmark tasks
  const loadTasks = useCallback(async () => {
    try {
      const res = await api.get_benchmark_tasks();
      if (res.success && Array.isArray(res.tasks)) {
        setTasks(res.tasks);
        setSelectedTaskIds(res.tasks.map((t) => t.id));
      }
    } catch (err: any) {
      showToast(`Ошибка загрузки списка тестов: ${err.message || err}`, 'error');
    }
  }, [showToast]);

  // Load status and last report
  const checkStatus = useCallback(async () => {
    try {
      const res = await api.get_benchmark_status();
      if (res.success) {
        setIsRunning(res.isRunning);
        if (res.lastReport) {
          setReport(res.lastReport);
        }
      }
    } catch {}
  }, []);

  useEffect(() => {
    loadTasks();
    checkStatus();
  }, [loadTasks, checkStatus]);

  // WebSocket event listeners for live progress
  useEffect(() => {
    const unProgress = api.listen<any>('benchmark:progress', (event) => {
      const payload = event.payload;
      if (payload.type === 'task_start') {
        setCurrentProgress({
          taskId: payload.taskId,
          taskIndex: payload.taskIndex,
          totalTasks: payload.totalTasks,
        });
      } else if (payload.type === 'task_complete' && payload.result) {
        setReport((prev) => {
          const prevResults = prev?.results || [];
          const updatedResults = [...prevResults.filter((r) => r.taskId !== payload.result.taskId), payload.result];
          const passedCount = updatedResults.filter((r) => r.passed).length;
          const overallScore = Math.round(updatedResults.reduce((acc, r) => acc + r.score, 0) / updatedResults.length);
          return {
            modelName: prev?.modelName || modelName,
            provider: prev?.provider || provider,
            timestamp: Date.now(),
            totalTasks: payload.totalTasks,
            passedTasks: passedCount,
            overallScore,
            averageTokensPerSec: prev?.averageTokensPerSec || payload.result.tokensPerSec,
            averageLatencyMs: prev?.averageLatencyMs || payload.result.latencyMs,
            averageTtftMs: prev?.averageTtftMs || payload.result.ttftMs,
            results: updatedResults,
          };
        });
      }
    });

    const unCompleted = api.listen<BenchmarkSuiteReport>('benchmark:completed', (event) => {
      setReport(event.payload);
      setIsRunning(false);
      setCurrentProgress(null);
      showToast('Бенчмарк успешно завершен!', 'success');
    });

    const unStatus = api.listen<any>('benchmark:status', (event) => {
      setIsRunning(event.payload.isRunning);
      if (!event.payload.isRunning) {
        setCurrentProgress(null);
      }
    });

    return () => {
      unProgress();
      unCompleted();
      unStatus();
    };
  }, [modelName, provider, showToast]);

  const handleToggleTask = (id: string) => {
    setSelectedTaskIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleSelectAllTasks = () => {
    if (selectedTaskIds.length === tasks.length) {
      setSelectedTaskIds([]);
    } else {
      setSelectedTaskIds(tasks.map((t) => t.id));
    }
  };

  const handleToggleExpand = (taskId: string) => {
    setExpandedTasks((prev) => ({ ...prev, [taskId]: !prev[taskId] }));
  };

  const handleRunBenchmark = async () => {
    if (selectedTaskIds.length === 0) {
      showToast('Выберите хотя бы один тест для запуска', 'error');
      return;
    }

    setIsRunning(true);
    setReport(null);
    setCurrentProgress({ taskId: selectedTaskIds[0], taskIndex: 0, totalTasks: selectedTaskIds.length });

    try {
      const res = await api.run_benchmark({
        provider,
        model: modelName.trim() || undefined,
        endpoint: provider === 'openai' || provider === 'local' ? customEndpoint.trim() : undefined,
        taskIds: selectedTaskIds,
      });

      if (res.success && res.report) {
        setReport(res.report);
      }
    } catch (err: any) {
      showToast(`Ошибка запуска бенчмарка: ${err.message || err}`, 'error');
      setIsRunning(false);
      setCurrentProgress(null);
    }
  };

  // Pre-calculated stats
  const progressPercent = useMemo(() => {
    if (!currentProgress || currentProgress.totalTasks === 0) return 0;
    return Math.round(((currentProgress.taskIndex + 1) / currentProgress.totalTasks) * 100);
  }, [currentProgress]);

  return (
    <div className="w-full h-full flex flex-col bg-[var(--theme-bg)] text-[var(--theme-text)] overflow-hidden font-sans select-none">
      {/* 1. TOP HEADER */}
      <div className="p-4 sm:p-5 border-b border-[var(--theme-border)] bg-[var(--theme-panel)] flex flex-wrap items-center justify-between gap-3 shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
            <Activity size={20} />
          </div>
          <div>
            <h1 className="text-base sm:text-lg font-bold flex items-center gap-2 text-[var(--theme-text)]">
              Тестирование и бенчмарк моделей
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                0xAgent Eval Suite
              </span>
            </h1>
            <p className="text-xs text-[var(--theme-text-muted)]">
              Оценка интеллекта, строгого следования правилам, синтеза кода, протокола инструментов и скорости (TTFT / t/s).
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={loadTasks}
            disabled={isRunning}
            className="p-2 rounded-xl border border-[var(--theme-border)] text-[var(--theme-text-muted)] hover:text-[var(--theme-text)] hover:bg-[var(--theme-border-subtle)] active:scale-95 transition-all cursor-pointer disabled:opacity-50"
            title="Обновить тесты"
          >
            <RefreshCw size={15} className={isRunning ? 'animate-spin' : ''} />
          </button>

          <button
            type="button"
            onClick={handleRunBenchmark}
            disabled={isRunning || selectedTaskIds.length === 0}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-xs sm:text-sm shadow-md active:scale-95 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isRunning ? (
              <>
                <RefreshCw size={15} className="animate-spin" />
                <span>Тестирование... ({progressPercent}%)</span>
              </>
            ) : (
              <>
                <Play size={15} className="fill-white" />
                <span>Запустить тест ({selectedTaskIds.length})</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* 2. SCROLLABLE CONTENT BODY */}
      <div className="flex-1 min-h-0 overflow-y-auto p-4 sm:p-5 space-y-5">
        {/* RUN CONFIGURATION CARD */}
        <div className="p-4 rounded-2xl border border-[var(--theme-border)] bg-[var(--theme-panel)] space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xs sm:text-sm font-semibold flex items-center gap-2 text-[var(--theme-text)]">
              <Sliders size={15} className="text-indigo-400" />
              Параметры тестируемой модели
            </h2>
            <div className="text-[11px] text-[var(--theme-text-muted)]">
              Выбрано тестов: <span className="text-indigo-400 font-bold">{selectedTaskIds.length}</span> из {tasks.length}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {/* Provider Picker */}
            <div>
              <label className="block text-[11px] font-medium text-[var(--theme-text-muted)] mb-1.5">
                Источник инференса
              </label>
              <div className="grid grid-cols-2 gap-1 p-1 rounded-xl bg-[var(--theme-bg)] border border-[var(--theme-border)]">
                <button
                  type="button"
                  onClick={() => setProvider('local')}
                  className={`py-1.5 text-xs font-medium rounded-lg transition-all ${
                    provider === 'local'
                      ? 'bg-indigo-600 text-white shadow-xs'
                      : 'text-[var(--theme-text-muted)] hover:text-[var(--theme-text)]'
                  }`}
                >
                  Локальная (llama.cpp)
                </button>
                <button
                  type="button"
                  onClick={() => setProvider('antigravity')}
                  className={`py-1.5 text-xs font-medium rounded-lg transition-all ${
                    provider === 'antigravity'
                      ? 'bg-indigo-600 text-white shadow-xs'
                      : 'text-[var(--theme-text-muted)] hover:text-[var(--theme-text)]'
                  }`}
                >
                  Antigravity (agy CLI)
                </button>
              </div>
            </div>

            {/* Model Name */}
            <div>
              <label className="block text-[11px] font-medium text-[var(--theme-text-muted)] mb-1.5">
                Идентификатор модели
              </label>
              <input
                type="text"
                value={modelName}
                onChange={(e) => setModelName(e.target.value)}
                disabled={isRunning}
                placeholder={provider === 'antigravity' ? 'gemini-2.5-flash' : 'local:qwen2.5-coder-32b.gguf'}
                className="w-full px-3 py-1.5 text-xs rounded-xl bg-[var(--theme-bg)] border border-[var(--theme-border)] text-[var(--theme-text)] focus:outline-none focus:border-indigo-500 font-mono transition-colors"
              />
              <div className="flex items-center gap-1.5 mt-1 text-[10px] text-[var(--theme-text-muted)] overflow-x-auto py-0.5">
                <span className="shrink-0">Пресеты:</span>
                {provider === 'antigravity' ? (
                  ['gemini-2.5-flash', 'gemini-2.5-pro', 'claude-3-7-sonnet-thinking'].map((p) => (
                    <button
                      key={p}
                      type="button"
                      onClick={() => setModelName(p)}
                      className="px-1.5 py-0.5 rounded bg-[var(--theme-border-subtle)] hover:text-indigo-400 font-mono cursor-pointer shrink-0"
                    >
                      {p}
                    </button>
                  ))
                ) : (
                  ['local:qwen2.5-coder-32b.gguf', 'local:gemma-4-31b-it.gguf', 'local:qwen2.5-coder-7b.gguf'].map((p) => (
                    <button
                      key={p}
                      type="button"
                      onClick={() => setModelName(p)}
                      className="px-1.5 py-0.5 rounded bg-[var(--theme-border-subtle)] hover:text-indigo-400 font-mono cursor-pointer shrink-0"
                    >
                      {p.replace('local:', '')}
                    </button>
                  ))
                )}
              </div>
            </div>

            {/* Endpoint */}
            {provider === 'local' && (
              <div>
                <label className="block text-[11px] font-medium text-[var(--theme-text-muted)] mb-1.5">
                  HTTP API Эндпоинт
                </label>
                <input
                  type="text"
                  value={customEndpoint}
                  onChange={(e) => setCustomEndpoint(e.target.value)}
                  disabled={isRunning}
                  placeholder="http://127.0.0.1:8080/v1"
                  className="w-full px-3 py-1.5 text-xs rounded-xl bg-[var(--theme-bg)] border border-[var(--theme-border)] text-[var(--theme-text)] focus:outline-none focus:border-indigo-500 font-mono transition-colors"
                />
              </div>
            )}
          </div>

          {/* TASK SELECTION TOGGLES */}
          <div className="pt-2 border-t border-[var(--theme-border)]">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-semibold text-[var(--theme-text-muted)] uppercase tracking-wider">
                Тестовый набор (Eval Tasks)
              </span>
              <button
                type="button"
                onClick={handleSelectAllTasks}
                className="text-[11px] text-indigo-400 hover:underline flex items-center gap-1 cursor-pointer"
              >
                {selectedTaskIds.length === tasks.length ? (
                  <>
                    <Square size={13} />
                    <span>Снять выбор со всех</span>
                  </>
                ) : (
                  <>
                    <CheckSquare size={13} />
                    <span>Выбрать все</span>
                  </>
                )}
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
              {tasks.map((task) => {
                const isSelected = selectedTaskIds.includes(task.id);
                const catMeta = CATEGORY_LABELS[task.category] || {
                  label: task.category,
                  color: 'bg-neutral-500/10 text-neutral-400 border-neutral-500/20',
                };
                return (
                  <div
                    key={task.id}
                    onClick={() => !isRunning && handleToggleTask(task.id)}
                    className={`p-2.5 rounded-xl border transition-all cursor-pointer select-none flex flex-col justify-between ${
                      isSelected
                        ? 'border-indigo-500/40 bg-indigo-500/5'
                        : 'border-[var(--theme-border)] bg-[var(--theme-bg)] opacity-60 hover:opacity-100'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-1.5">
                      <span className="text-xs font-medium text-[var(--theme-text)] line-clamp-1">
                        {task.name}
                      </span>
                      {isSelected ? (
                        <CheckSquare size={14} className="text-indigo-400 shrink-0 mt-0.5" />
                      ) : (
                        <Square size={14} className="text-[var(--theme-text-muted)] shrink-0 mt-0.5" />
                      )}
                    </div>
                    <div className="mt-2 flex items-center justify-between">
                      <span className={`text-[9px] px-1.5 py-0.5 rounded-md border ${catMeta.color}`}>
                        {catMeta.label}
                      </span>
                      <span className="text-[9px] font-mono text-[var(--theme-text-muted)]">
                        {task.id}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* LIVE PROGRESS BAR (when running) */}
        {isRunning && (
          <div className="p-4 rounded-2xl border border-indigo-500/30 bg-indigo-500/5 space-y-2 animate-pulse">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-indigo-400 flex items-center gap-2">
                <RefreshCw size={14} className="animate-spin" />
                Тестирование в процессе: задача {currentProgress ? currentProgress.taskIndex + 1 : 1} из{' '}
                {currentProgress ? currentProgress.totalTasks : selectedTaskIds.length}
              </span>
              <span className="font-mono text-indigo-400 font-bold">{progressPercent}%</span>
            </div>
            <div className="w-full h-2 rounded-full bg-[var(--theme-border)] overflow-hidden">
              <div
                className="h-full bg-indigo-500 transition-all duration-300 rounded-full"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>
        )}

        {/* SUMMARY DASHBOARD CARDS */}
        {report && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {/* OVERALL SCORE */}
            <div className="p-4 rounded-2xl border border-[var(--theme-border)] bg-[var(--theme-panel)] flex flex-col justify-between">
              <div className="flex items-center justify-between text-[var(--theme-text-muted)] text-xs">
                <span>Общий балл (IQ/Eval)</span>
                <Sparkles size={16} className="text-indigo-400" />
              </div>
              <div className="mt-2 flex items-baseline gap-2">
                <span
                  className={`text-2xl sm:text-3xl font-bold ${
                    report.overallScore >= 80
                      ? 'text-emerald-400'
                      : report.overallScore >= 50
                      ? 'text-amber-400'
                      : 'text-rose-400'
                  }`}
                >
                  {report.overallScore}%
                </span>
                <span className="text-xs text-[var(--theme-text-muted)]">
                  ({report.passedTasks} из {report.totalTasks} пройдено)
                </span>
              </div>
            </div>

            {/* SPEED */}
            <div className="p-4 rounded-2xl border border-[var(--theme-border)] bg-[var(--theme-panel)] flex flex-col justify-between">
              <div className="flex items-center justify-between text-[var(--theme-text-muted)] text-xs">
                <span>Скорость генерации</span>
                <Zap size={16} className="text-amber-400" />
              </div>
              <div className="mt-2 flex items-baseline gap-1">
                <span className="text-2xl sm:text-3xl font-bold text-amber-400">
                  {report.averageTokensPerSec.toFixed(1)}
                </span>
                <span className="text-xs text-[var(--theme-text-muted)] font-mono">т/сек</span>
              </div>
            </div>

            {/* LATENCY */}
            <div className="p-4 rounded-2xl border border-[var(--theme-border)] bg-[var(--theme-panel)] flex flex-col justify-between">
              <div className="flex items-center justify-between text-[var(--theme-text-muted)] text-xs">
                <span>Задержка первого токена (TTFT)</span>
                <Clock size={16} className="text-cyan-400" />
              </div>
              <div className="mt-2 flex items-baseline gap-1">
                <span className="text-2xl sm:text-3xl font-bold text-cyan-400">
                  {report.averageTtftMs}
                </span>
                <span className="text-xs text-[var(--theme-text-muted)] font-mono">мс</span>
              </div>
            </div>

            {/* MODEL & PROVIDER */}
            <div className="p-4 rounded-2xl border border-[var(--theme-border)] bg-[var(--theme-panel)] flex flex-col justify-between">
              <div className="flex items-center justify-between text-[var(--theme-text-muted)] text-xs">
                <span>Протестировано</span>
                <Cpu size={16} className="text-purple-400" />
              </div>
              <div className="mt-2 min-w-0">
                <div className="text-xs font-mono font-bold truncate text-[var(--theme-text)]">
                  {report.modelName}
                </div>
                <div className="text-[10px] text-[var(--theme-text-muted)] uppercase tracking-wider mt-0.5">
                  Провайдер: {report.provider}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* RESULTS TABLE & ACCORDIONS */}
        {report && report.results && report.results.length > 0 && (
          <div className="space-y-3">
            <h3 className="text-xs sm:text-sm font-semibold flex items-center gap-2 text-[var(--theme-text)]">
              <Layers size={15} className="text-indigo-400" />
              Подробные результаты по критериям
            </h3>

            <div className="space-y-2">
              {report.results.map((res: BenchmarkTestResult) => {
                const isExpanded = !!expandedTasks[res.taskId];
                const catMeta = CATEGORY_LABELS[res.category] || {
                  label: res.category,
                  color: 'bg-neutral-500/10 text-neutral-400 border-neutral-500/20',
                };
                const taskDef = tasks.find((t) => t.id === res.taskId);

                return (
                  <div
                    key={res.taskId}
                    className="rounded-2xl border border-[var(--theme-border)] bg-[var(--theme-panel)] overflow-hidden transition-all shadow-xs"
                  >
                    {/* Header Row */}
                    <div
                      onClick={() => handleToggleExpand(res.taskId)}
                      className="p-3 sm:p-4 flex items-center justify-between gap-3 cursor-pointer hover:bg-[var(--theme-border-subtle)] select-none transition-colors"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        {res.passed ? (
                          <CheckCircle2 size={18} className="text-emerald-400 shrink-0" />
                        ) : (
                          <XCircle size={18} className="text-rose-400 shrink-0" />
                        )}
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-xs sm:text-sm font-semibold text-[var(--theme-text)] truncate">
                              {res.name}
                            </span>
                            <span className={`text-[9px] px-1.5 py-0.5 rounded-md border ${catMeta.color}`}>
                              {catMeta.label}
                            </span>
                          </div>
                          <p className="text-[11px] text-[var(--theme-text-muted)] mt-0.5 truncate">
                            {res.details}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-3 shrink-0">
                        <div className="hidden sm:flex flex-col text-right font-mono text-[11px]">
                          <span className="text-amber-400">{res.tokensPerSec.toFixed(1)} т/с</span>
                          <span className="text-[var(--theme-text-muted)] text-[10px]">
                            {(res.latencyMs / 1000).toFixed(2)}s
                          </span>
                        </div>

                        <span
                          className={`text-xs sm:text-sm font-bold px-2.5 py-1 rounded-xl border ${
                            res.score >= 80
                              ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                              : res.score >= 50
                              ? 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                              : 'bg-rose-500/10 text-rose-400 border-rose-500/20'
                          }`}
                        >
                          {res.score}%
                        </span>

                        {isExpanded ? (
                          <ChevronUp size={16} className="text-[var(--theme-text-muted)]" />
                        ) : (
                          <ChevronDown size={16} className="text-[var(--theme-text-muted)]" />
                        )}
                      </div>
                    </div>

                    {/* Expandable Details Block */}
                    {isExpanded && (
                      <div className="p-4 border-t border-[var(--theme-border)] bg-[var(--theme-bg)] space-y-3">
                        {/* Task Prompt */}
                        {taskDef && (
                          <div>
                            <div className="text-[10px] font-semibold text-[var(--theme-text-muted)] uppercase tracking-wider mb-1 flex items-center gap-1">
                              <Terminal size={12} />
                              Входной промпт теста
                            </div>
                            <pre className="p-3 rounded-xl bg-[var(--theme-panel)] border border-[var(--theme-border)] text-xs text-[var(--theme-text)] font-mono whitespace-pre-wrap select-text">
                              {taskDef.prompt}
                            </pre>
                          </div>
                        )}

                        {/* Model Output */}
                        <div>
                          <div className="text-[10px] font-semibold text-[var(--theme-text-muted)] uppercase tracking-wider mb-1 flex items-center gap-1">
                            <Cpu size={12} />
                            Фактический ответ модели
                          </div>
                          <pre className="p-3 rounded-xl bg-[var(--theme-panel)] border border-[var(--theme-border)] text-xs text-[var(--theme-text)] font-mono whitespace-pre-wrap select-text max-h-60 overflow-y-auto">
                            {res.output || '(Пустой ответ модели)'}
                          </pre>
                        </div>

                        {/* Metrics Breakdown */}
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 border-t border-[var(--theme-border)] text-[11px] font-mono">
                          <div className="text-[var(--theme-text-muted)]">
                            TTFT:{' '}
                            <span className="text-[var(--theme-text)] font-bold">{res.ttftMs} мс</span>
                          </div>
                          <div className="text-[var(--theme-text-muted)]">
                            Общее время:{' '}
                            <span className="text-[var(--theme-text)] font-bold">
                              {(res.latencyMs / 1000).toFixed(2)} с
                            </span>
                          </div>
                          <div className="text-[var(--theme-text-muted)]">
                            Токенов вывода:{' '}
                            <span className="text-[var(--theme-text)] font-bold">
                              {res.completionTokens}
                            </span>
                          </div>
                          <div className="text-[var(--theme-text-muted)]">
                            Скорость:{' '}
                            <span className="text-amber-400 font-bold">
                              {res.tokensPerSec.toFixed(1)} т/сек
                            </span>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* EMPTY STATE */}
        {!report && !isRunning && (
          <div className="p-12 rounded-2xl border border-dashed border-[var(--theme-border)] text-center space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 flex items-center justify-center mx-auto">
              <Activity size={24} />
            </div>
            <h3 className="text-sm font-semibold text-[var(--theme-text)]">
              Тестирование еще не запускалось
            </h3>
            <p className="text-xs text-[var(--theme-text-muted)] max-w-md mx-auto">
              Выберите параметры модели выше и нажмите «Запустить тест» для проверки интеллекта, логики, синтеза кода и замера скорости инференса.
            </p>
          </div>
        )}
      </div>
    </div>
  );
});
