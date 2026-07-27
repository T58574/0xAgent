import React, { useState, useMemo } from 'react';
import { Activity, Zap, Brain, Database, CheckCircle2, RefreshCw, Layers, Search, Terminal } from 'lucide-react';
import { ChatSession, ChatMessage } from '../../types';

interface AnalyticsPageProps {
  sessions: ChatSession[];
  serverLogs: string[];
  onRefresh?: () => void;
}

export const AnalyticsPage: React.FC<AnalyticsPageProps> = ({ sessions, serverLogs, onRefresh }) => {
  const [searchFilter, setSearchFilter] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<'all' | 'high_speed' | 'high_context' | 'errors'>('all');

  // Extract all assistant messages with metrics
  const allAssistantMessages = useMemo(() => {
    const msgs: Array<{ sessionTitle: string; sessionId: string; msg: ChatMessage }> = [];
    for (const session of sessions) {
      for (const msg of session.messages) {
        if (msg.role === 'assistant') {
          msgs.push({ sessionTitle: session.title, sessionId: session.id, msg });
        }
      }
    }
    return msgs.sort((a, b) => b.msg.timestamp - a.msg.timestamp);
  }, [sessions]);

  // Aggregate metrics
  const stats = useMemo(() => {
    let totalEvalTokens = 0;
    let totalPromptTokens = 0;
    let totalEvalTimeMs = 0;
    let maxContextPercent = 0;
    let speedSum = 0;
    let speedCount = 0;
    let errorCount = 0;
    let totalCount = allAssistantMessages.length;

    for (const item of allAssistantMessages) {
      const m = item.msg.metrics;
      if (m) {
        if (m.completionTokens) totalEvalTokens += m.completionTokens;
        if (m.promptTokens) totalPromptTokens += m.promptTokens;
        if (m.evalDurationMs) totalEvalTimeMs += m.evalDurationMs;
        if (m.tokensPerSec && m.tokensPerSec > 0) {
          speedSum += m.tokensPerSec;
          speedCount++;
        }
        if (m.contextUsed && m.contextMax && m.contextMax > 0) {
          const pct = (m.contextUsed / m.contextMax) * 100;
          if (pct > maxContextPercent) maxContextPercent = pct;
        }
      }
      if (item.msg.content.includes('Ошибка') || item.msg.content.includes('Error')) {
        errorCount++;
      }
    }

    const avgSpeed = speedCount > 0 ? (speedSum / speedCount).toFixed(1) : '0.0';
    const totalTokens = totalEvalTokens + totalPromptTokens;
    const successRate = totalCount > 0 ? (((totalCount - errorCount) / totalCount) * 100).toFixed(1) : '100.0';

    return {
      avgSpeed,
      totalTokens,
      totalEvalTokens,
      totalPromptTokens,
      maxContextPercent: maxContextPercent.toFixed(1),
      successRate,
      errorCount,
      totalCount,
    };
  }, [allAssistantMessages]);

  // Filter messages for table
  const filteredMessages = useMemo(() => {
    return allAssistantMessages.filter((item) => {
      const m = item.msg.metrics;
      const textMatches =
        !searchFilter ||
        item.msg.content.toLowerCase().includes(searchFilter.toLowerCase()) ||
        item.sessionTitle.toLowerCase().includes(searchFilter.toLowerCase()) ||
        (m?.modelName && m.modelName.toLowerCase().includes(searchFilter.toLowerCase()));

      if (!textMatches) return false;

      if (selectedCategory === 'high_speed') return (m?.tokensPerSec || 0) >= 30;
      if (selectedCategory === 'high_context') return ((m?.contextUsed || 0) / (m?.contextMax || 8192)) >= 0.4;
      if (selectedCategory === 'errors') return item.msg.content.includes('Ошибка') || item.msg.content.includes('Error');

      return true;
    });
  }, [allAssistantMessages, searchFilter, selectedCategory]);

  return (
    <div className="flex-1 flex flex-col h-full bg-theme-bg overflow-y-auto p-4 sm:p-6 space-y-6 scrollbar-thin font-sans">
      
      {/* HEADER BAR */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[var(--theme-border)] pb-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-100 flex items-center gap-2.5">
            <Activity className="text-emerald-400" size={24} />
            <span>Аналитика & Телеметрия Производительности</span>
          </h1>
          <p className="text-xs text-slate-400 mt-1 font-mono">
            Мониторинг скорости токенов (t/s), заполнении контекста, объема диалогов и ошибок в реальном времени.
          </p>
        </div>

        {onRefresh && (
          <button
            onClick={onRefresh}
            className="flat-btn px-3.5 py-1.5 rounded-md text-xs font-medium text-slate-300 hover:text-white flex items-center gap-1.5 cursor-pointer self-start sm:self-auto border-[var(--theme-border)]"
          >
            <RefreshCw size={14} />
            <span>Обновить данные</span>
          </button>
        )}
      </div>

      {/* KPI METRIC CARDS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        
        {/* KPI 1: Speed */}
        <div className="glass-panel p-4 rounded-xl border border-emerald-500/30 bg-slate-900/60 shadow-lg relative overflow-hidden group">
          <div className="flex items-center justify-between text-slate-400 mb-2 text-xs font-medium">
            <span>Средняя Скорость (t/s)</span>
            <Zap size={16} className="text-emerald-400" />
          </div>
          <div className="text-2xl sm:text-3xl font-bold font-mono text-emerald-400 tracking-tight">
            {stats.avgSpeed} <span className="text-xs font-sans text-slate-400">т/сек</span>
          </div>
          <div className="text-[11px] text-slate-400 mt-2 flex items-center gap-1 font-mono">
            <span className="text-emerald-400 font-semibold">Живой расчет</span> генерации токенов
          </div>
          <div className="absolute right-0 bottom-0 w-24 h-24 bg-emerald-500/5 rounded-full blur-xl pointer-events-none" />
        </div>

        {/* KPI 2: Tokens */}
        <div className="glass-panel p-4 rounded-xl border border-purple-500/30 bg-slate-900/60 shadow-lg relative overflow-hidden group">
          <div className="flex items-center justify-between text-slate-400 mb-2 text-xs font-medium">
            <span>Обработано Токенов</span>
            <Database size={16} className="text-purple-400" />
          </div>
          <div className="text-2xl sm:text-3xl font-bold font-mono text-purple-300 tracking-tight">
            {stats.totalTokens.toLocaleString()}
          </div>
          <div className="text-[11px] text-slate-400 mt-2 flex items-center justify-between font-mono">
            <span>Промпт: {stats.totalPromptTokens.toLocaleString()}</span>
            <span>Вывод: {stats.totalEvalTokens.toLocaleString()}</span>
          </div>
          <div className="absolute right-0 bottom-0 w-24 h-24 bg-purple-500/5 rounded-full blur-xl pointer-events-none" />
        </div>

        {/* KPI 3: Context Peak */}
        <div className="glass-panel p-4 rounded-xl border border-blue-500/30 bg-slate-900/60 shadow-lg relative overflow-hidden group">
          <div className="flex items-center justify-between text-slate-400 mb-2 text-xs font-medium">
            <span>Пик Контекстного Окна</span>
            <Brain size={16} className="text-blue-400" />
          </div>
          <div className="text-2xl sm:text-3xl font-bold font-mono text-blue-300 tracking-tight">
            {stats.maxContextPercent}%
          </div>
          <div className="w-full bg-slate-950 h-1.5 rounded-full overflow-hidden mt-3.5 border border-white/5">
            <div
              className="bg-blue-400 h-full transition-all duration-500"
              style={{ width: `${Math.min(100, Number(stats.maxContextPercent))}%` }}
            />
          </div>
          <div className="absolute right-0 bottom-0 w-24 h-24 bg-blue-500/5 rounded-full blur-xl pointer-events-none" />
        </div>

        {/* KPI 4: Reliability */}
        <div className="glass-panel p-4 rounded-xl border border-amber-500/30 bg-slate-900/60 shadow-lg relative overflow-hidden group">
          <div className="flex items-center justify-between text-slate-400 mb-2 text-xs font-medium">
            <span>Надежность Исполнения</span>
            <CheckCircle2 size={16} className="text-amber-400" />
          </div>
          <div className="text-2xl sm:text-3xl font-bold font-mono text-amber-300 tracking-tight">
            {stats.successRate}%
          </div>
          <div className="text-[11px] text-slate-400 mt-2 flex items-center justify-between font-mono">
            <span>Всего ответов: {stats.totalCount}</span>
            <span className="text-rose-400">Ошибок: {stats.errorCount}</span>
          </div>
          <div className="absolute right-0 bottom-0 w-24 h-24 bg-amber-500/5 rounded-full blur-xl pointer-events-none" />
        </div>

      </div>

      {/* TELEMETRY TABLE & FILTERS */}
      <div className="glass-panel rounded-xl border border-[var(--theme-border)] bg-slate-900/40 p-4 space-y-4 shadow-xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Layers className="text-emerald-400" size={18} />
            <h2 className="text-sm font-semibold text-slate-100 uppercase tracking-wider">
              Логи Телеметрии Сообщений
            </h2>
            <span className="px-2 py-0.5 rounded-full text-[10px] bg-slate-800 text-slate-300 font-mono">
              {filteredMessages.length} записей
            </span>
          </div>

          {/* Filter Pills */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search size={14} className="absolute left-2.5 top-2 text-slate-400" />
              <input
                type="text"
                value={searchFilter}
                onChange={(e) => setSearchFilter(e.target.value)}
                placeholder="Поиск по тексту или модели..."
                className="pl-8 pr-3 py-1 rounded flat-input text-xs text-slate-200 focus:outline-none w-48 sm:w-56"
              />
            </div>
            
            <button
              onClick={() => setSelectedCategory('all')}
              className={`px-2.5 py-1 rounded text-xs font-medium cursor-pointer transition-colors ${
                selectedCategory === 'all'
                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
              }`}
            >
              Все
            </button>
            <button
              onClick={() => setSelectedCategory('high_speed')}
              className={`px-2.5 py-1 rounded text-xs font-medium cursor-pointer transition-colors ${
                selectedCategory === 'high_speed'
                  ? 'bg-purple-500/20 text-purple-300 border border-purple-500/40'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
              }`}
            >
              Высокая скорость (≥30 t/s)
            </button>
            <button
              onClick={() => setSelectedCategory('errors')}
              className={`px-2.5 py-1 rounded text-xs font-medium cursor-pointer transition-colors ${
                selectedCategory === 'errors'
                  ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
              }`}
            >
              Ошибки ({stats.errorCount})
            </button>
          </div>
        </div>

        {/* TABLE */}
        <div className="overflow-x-auto rounded-lg border border-white/5">
          <table className="w-full text-xs text-left border-collapse">
            <thead className="bg-slate-950 text-slate-300 font-semibold border-b border-[var(--theme-border)] uppercase tracking-wider text-[10px]">
              <tr>
                <th className="p-3">Время / Сессия</th>
                <th className="p-3">Модель</th>
                <th className="p-3">Скорость (t/s)</th>
                <th className="p-3">Токены (Промпт / Вывод)</th>
                <th className="p-3">Заполнение Контекста</th>
                <th className="p-3">Время (мс)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5 bg-slate-900/60 font-mono text-slate-300">
              {filteredMessages.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-slate-500 font-sans">
                    Записи телеметрии не найдены.
                  </td>
                </tr>
              ) : (
                filteredMessages.map((item) => {
                  const m = item.msg.metrics;
                  const ctxPercent = m?.contextUsed && m?.contextMax ? ((m.contextUsed / m.contextMax) * 100).toFixed(1) : '0.0';

                  return (
                    <tr key={item.msg.id} className="hover:bg-white/5 transition-colors">
                      <td className="p-3 font-sans">
                        <div className="font-semibold text-slate-200 truncate max-w-xs">{item.sessionTitle}</div>
                        <div className="text-[10px] text-slate-500 font-mono">
                          {new Date(item.msg.timestamp).toLocaleTimeString()}
                        </div>
                      </td>
                      <td className="p-3">
                        <span className="px-2 py-0.5 rounded bg-slate-800 text-purple-300 border border-purple-500/20 text-[11px]">
                          {m?.modelName || 'qwen2.5-coder:7b'}
                        </span>
                      </td>
                      <td className="p-3">
                        {m?.tokensPerSec ? (
                          <span className="font-bold text-emerald-400 text-xs">
                            {m.tokensPerSec} t/s
                          </span>
                        ) : (
                          <span className="text-slate-500">—</span>
                        )}
                      </td>
                      <td className="p-3 text-slate-300">
                        {m?.promptTokens !== undefined ? (
                          <span>
                            <span className="text-slate-400">{m.promptTokens}</span> +{' '}
                            <span className="text-emerald-400">{m.completionTokens}</span> ={' '}
                            <span className="font-semibold">{m.totalTokens}</span>
                          </span>
                        ) : (
                          <span className="text-slate-500">—</span>
                        )}
                      </td>
                      <td className="p-3">
                        <div className="flex items-center gap-2">
                          <div className="w-16 bg-slate-950 h-1.5 rounded-full overflow-hidden border border-white/5">
                            <div
                              className="bg-blue-400 h-full"
                              style={{ width: `${Math.min(100, Number(ctxPercent))}%` }}
                            />
                          </div>
                          <span className="text-[11px] text-slate-400">{ctxPercent}%</span>
                        </div>
                      </td>
                      <td className="p-3 text-slate-400">
                        {m?.evalDurationMs ? `${m.evalDurationMs} ms` : '—'}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* DIAGNOSTIC SERVER LOGS */}
      <div className="glass-panel rounded-xl border border-[var(--theme-border)] bg-slate-900/40 p-4 space-y-3 shadow-xl">
        <div className="flex items-center gap-2">
          <Terminal className="text-purple-400" size={18} />
          <h2 className="text-sm font-semibold text-slate-100 uppercase tracking-wider">
            Живой Терминал и Системный Лог Сервера
          </h2>
        </div>
        <div className="bg-slate-950 p-3 rounded-lg border border-white/5 font-mono text-[11px] text-slate-300 max-h-48 overflow-y-auto whitespace-pre-wrap leading-relaxed">
          {serverLogs.length === 0 ? (
            <span className="text-slate-500">Логи сервера пока отсутствуют.</span>
          ) : (
            serverLogs.slice(-50).map((log, idx) => (
              <div key={idx} className={log.includes('[ERROR]') || log.includes('Ошибка') ? 'text-rose-400 font-semibold' : ''}>
                {log}
              </div>
            ))
          )}
        </div>
      </div>

    </div>
  );
};
