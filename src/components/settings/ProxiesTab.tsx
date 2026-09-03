import React, { useState, useEffect, useCallback } from 'react';
import {
  Shield,
  Plus,
  RefreshCw,
  Trash2,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Copy,
  Check,
  Globe,
  Zap,
} from 'lucide-react';
import { ProxyItem, ProxyProtocol } from '../../types';
import * as api from '../../services/api';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { Card } from '../ui/Card';
import { Toggle } from '../ui/Toggle';
import { SettingsHeader, SettingsSection } from './common';

export const ProxiesTab: React.FC = () => {
  const [proxies, setProxies] = useState<ProxyItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [checkingAll, setCheckingAll] = useState<boolean>(false);
  const [checkingIds, setCheckingIds] = useState<Set<string>>(new Set());
  const [showAddForm, setShowAddForm] = useState<boolean>(false);
  const [batchInput, setBatchInput] = useState<string>('');
  const [selectedProtocol, setSelectedProtocol] = useState<ProxyProtocol | ''>('');
  const [importMessage, setImportMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [copiedExport, setCopiedExport] = useState<boolean>(false);

  const fetchProxies = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api.list_proxies();
      setProxies(res.proxies || []);
    } catch (err: any) {
      console.error('[ProxiesTab] Failed to list proxies:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProxies();
  }, [fetchProxies]);

  const handleCheckAll = async () => {
    try {
      setCheckingAll(true);
      await api.check_proxies();
      await fetchProxies();
    } catch (err: any) {
      console.error('[ProxiesTab] Error checking all proxies:', err);
    } finally {
      setCheckingAll(false);
    }
  };

  const handleCheckSingle = async (id: string) => {
    try {
      setCheckingIds((prev) => new Set(prev).add(id));
      await api.check_proxies(id);
      await fetchProxies();
    } catch (err: any) {
      console.error(`[ProxiesTab] Error checking proxy ${id}:`, err);
    } finally {
      setCheckingIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  };

  const handleToggle = async (id: string, currentActive: boolean) => {
    try {
      const updated = await api.toggle_proxy(id, !currentActive);
      setProxies((prev) => prev.map((p) => (p.id === id ? updated : p)));
    } catch (err: any) {
      console.error(`[ProxiesTab] Error toggling proxy ${id}:`, err);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await api.delete_proxy(id);
      setProxies((prev) => prev.filter((p) => p.id !== id));
    } catch (err: any) {
      console.error(`[ProxiesTab] Error deleting proxy ${id}:`, err);
    }
  };

  const handleAddBatch = async () => {
    if (!batchInput.trim()) return;
    try {
      setImportMessage(null);
      const res = await api.add_proxies(
        batchInput,
        selectedProtocol ? (selectedProtocol as ProxyProtocol) : undefined
      );
      if (res.added > 0) {
        setImportMessage({
          type: 'success',
          text: `Успешно добавлено: ${res.added} прокси.${res.errors?.length ? ` Ошибок: ${res.errors.length}` : ''}`,
        });
        setBatchInput('');
        setShowAddForm(false);
        await fetchProxies();
      } else {
        setImportMessage({
          type: 'error',
          text: `Не удалось распознать формат. ${res.errors?.join('; ') || ''}`,
        });
      }
    } catch (err: any) {
      setImportMessage({ type: 'error', text: err?.message || 'Ошибка импорта' });
    }
  };

  const handleExportJson = async () => {
    try {
      const exp = await api.export_proxies();
      const text = JSON.stringify(exp, null, 2);
      await navigator.clipboard.writeText(text);
      setCopiedExport(true);
      setTimeout(() => setCopiedExport(false), 2000);
    } catch (err: any) {
      console.error('[ProxiesTab] Export failed:', err);
    }
  };

  // Stats
  const totalCount = proxies.length;
  const onlineCount = proxies.filter((p) => p.status === 'online').length;
  const offlineCount = proxies.filter((p) => p.status === 'offline').length;
  const activeCount = proxies.filter((p) => p.is_active).length;

  return (
    <div className="space-y-6 max-w-5xl">
      <SettingsHeader
        title="0xProxy & Сетевые шлюзы"
        subtitle="Управление пулом SOCKS5, HTTP и HTTPS прокси. Автоматическая маршрутизация запросов агентов, ротация и мониторинг доступности."
      />

      {/* Metrics Summary Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card className="p-3 bg-[var(--theme-card-bg)] border border-[var(--theme-border)] rounded-xl flex items-center gap-3">
          <div className="p-2 rounded-lg bg-[var(--theme-border-subtle)] text-[var(--theme-text)]">
            <Globe size={18} />
          </div>
          <div>
            <div className="text-xs text-[var(--theme-text-muted)] font-medium">Всего в пуле</div>
            <div className="text-lg font-bold text-[var(--theme-text)]">{totalCount}</div>
          </div>
        </Card>

        <Card className="p-3 bg-[var(--theme-card-bg)] border border-[var(--theme-border)] rounded-xl flex items-center gap-3">
          <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400">
            <CheckCircle2 size={18} />
          </div>
          <div>
            <div className="text-xs text-[var(--theme-text-muted)] font-medium">Онлайн (доступны)</div>
            <div className="text-lg font-bold text-emerald-400">{onlineCount}</div>
          </div>
        </Card>

        <Card className="p-3 bg-[var(--theme-card-bg)] border border-[var(--theme-border)] rounded-xl flex items-center gap-3">
          <div className="p-2 rounded-lg bg-red-500/10 text-red-400">
            <XCircle size={18} />
          </div>
          <div>
            <div className="text-xs text-[var(--theme-text-muted)] font-medium">Ошибки / Офлайн</div>
            <div className="text-lg font-bold text-red-400">{offlineCount}</div>
          </div>
        </Card>

        <Card className="p-3 bg-[var(--theme-card-bg)] border border-[var(--theme-border)] rounded-xl flex items-center gap-3">
          <div className="p-2 rounded-lg bg-indigo-500/10 text-indigo-400">
            <Zap size={18} />
          </div>
          <div>
            <div className="text-xs text-[var(--theme-text-muted)] font-medium">Активных в ротации</div>
            <div className="text-lg font-bold text-indigo-400">{activeCount}</div>
          </div>
        </Card>
      </div>

      {/* Main Actions Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-[var(--theme-panel)] p-3 rounded-xl border border-[var(--theme-border)]">
        <div className="flex items-center gap-2">
          <Button
            variant="primary"
            size="sm"
            onClick={() => setShowAddForm(!showAddForm)}
            icon={<Plus size={15} />}
          >
            Добавить прокси
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={handleCheckAll}
            disabled={checkingAll || totalCount === 0}
            icon={<RefreshCw size={14} className={checkingAll ? 'animate-spin' : ''} />}
          >
            {checkingAll ? 'Проверка...' : 'Проверить все'}
          </Button>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleExportJson}
            icon={copiedExport ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
            title="Скопировать конфигурацию JSON в буфер обмена"
          >
            {copiedExport ? 'Скопировано' : 'Экспорт JSON'}
          </Button>
        </div>
      </div>

      {/* Add / Batch Import Card */}
      {showAddForm && (
        <Card className="p-4 bg-[var(--theme-card-bg)] border border-[var(--theme-border)] rounded-xl space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-[var(--theme-text)] flex items-center gap-2">
              <Plus size={16} className="text-[var(--theme-accent)]" />
              Добавление прокси (пакетный импорт)
            </h3>
            <span className="text-xs text-[var(--theme-text-muted)] font-mono">
              Поддерживаются: ip:port, ip:port:user:pass, socks5://user:pass@ip:port
            </span>
          </div>

          <div className="space-y-2">
            <textarea
              rows={4}
              value={batchInput}
              onChange={(e) => setBatchInput(e.target.value)}
              placeholder={"192.168.1.100:1080\nsocks5://admin:secret@10.0.0.1:9050\n185.220.101.5:8080:user:password"}
              className="w-full p-3 text-xs font-mono bg-[var(--theme-bg)] border border-[var(--theme-border)] rounded-lg text-[var(--theme-text)] placeholder-[var(--theme-text-muted)]/50 focus:outline-none focus:ring-1 focus:ring-[var(--theme-accent)]"
            />
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-xs">
              <span className="text-[var(--theme-text-muted)]">Принудительный протокол:</span>
              <select
                value={selectedProtocol}
                onChange={(e) => setSelectedProtocol(e.target.value as any)}
                className="px-2 py-1 bg-[var(--theme-bg)] border border-[var(--theme-border)] rounded text-xs text-[var(--theme-text)] focus:outline-none"
              >
                <option value="">Автоопределение</option>
                <option value="socks5">SOCKS5</option>
                <option value="http">HTTP</option>
                <option value="https">HTTPS</option>
              </select>
            </div>

            <div className="flex items-center gap-2">
              <Button variant="ghost" size="xs" onClick={() => setShowAddForm(false)}>
                Отмена
              </Button>
              <Button variant="primary" size="xs" onClick={handleAddBatch} disabled={!batchInput.trim()}>
                Импортировать
              </Button>
            </div>
          </div>

          {importMessage && (
            <div
              className={`p-2.5 rounded-lg text-xs flex items-center gap-2 ${
                importMessage.type === 'success'
                  ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                  : 'bg-red-500/10 text-red-400 border border-red-500/20'
              }`}
            >
              {importMessage.type === 'success' ? <CheckCircle2 size={15} /> : <AlertCircle size={15} />}
              <span>{importMessage.text}</span>
            </div>
          )}
        </Card>
      )}

      {/* Proxies List */}
      <SettingsSection
        title={`Список прокси (${totalCount})`}
        description="Прокси-ноды, используемые фоновыми агентами и поисковыми механизмами."
      >
        {loading ? (
          <div className="p-8 text-center text-xs text-[var(--theme-text-muted)] flex items-center justify-center gap-2">
            <RefreshCw size={14} className="animate-spin" />
            Загрузка списка прокси...
          </div>
        ) : proxies.length === 0 ? (
          <div className="p-8 text-center bg-[var(--theme-card-bg)] border border-[var(--theme-border)] rounded-xl space-y-2">
            <Shield size={32} className="mx-auto text-[var(--theme-text-muted)]/40" />
            <div className="text-sm font-medium text-[var(--theme-text)]">Пул прокси пуст</div>
            <p className="text-xs text-[var(--theme-text-muted)] max-w-md mx-auto">
              Добавьте свои SOCKS5 или HTTP прокси для обхода ограничений, сбора трендов и парсинга без раскрытия прямого IP.
            </p>
            <Button
              variant="secondary"
              size="xs"
              onClick={() => setShowAddForm(true)}
              className="mt-2"
              icon={<Plus size={13} />}
            >
              Добавить первый прокси
            </Button>
          </div>
        ) : (
          <div className="space-y-2">
            {proxies.map((p) => {
              const isCheckingThis = checkingIds.has(p.id);
              const statusColor =
                p.status === 'online'
                  ? 'text-emerald-400 border-emerald-500/30 bg-emerald-500/10'
                  : p.status === 'offline'
                  ? 'text-red-400 border-red-500/30 bg-red-500/10'
                  : p.status === 'checking'
                  ? 'text-amber-400 border-amber-500/30 bg-amber-500/10'
                  : 'text-[var(--theme-text-muted)] border-[var(--theme-border)] bg-[var(--theme-border-subtle)]';

              return (
                <div
                  key={p.id}
                  className={`p-3 rounded-xl border transition-all flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 ${
                    p.is_active
                      ? 'bg-[var(--theme-card-bg)] border-[var(--theme-border)] shadow-xs'
                      : 'bg-[var(--theme-panel)]/50 border-[var(--theme-border)] opacity-60'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <Badge variant="neutral" className="uppercase font-mono text-[10px] px-2 py-0.5">
                      {p.protocol}
                    </Badge>

                    <div className="min-w-0">
                      <div className="text-xs font-mono font-bold text-[var(--theme-text)] truncate flex items-center gap-2">
                        <span>{p.host}:{p.port}</span>
                        {p.auth?.username && (
                          <span className="text-[10px] font-sans font-normal text-[var(--theme-text-muted)] bg-[var(--theme-border-subtle)] px-1.5 py-0.2 rounded">
                            auth: {p.auth.username}
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-[var(--theme-text-muted)] flex items-center gap-2 mt-0.5">
                        {p.latency_ms !== null && p.latency_ms !== undefined && (
                          <span className="font-mono text-emerald-400 font-semibold">{p.latency_ms} мс</span>
                        )}
                        {p.last_checked_at && (
                          <span>
                            проверен: {new Date(p.last_checked_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                          </span>
                        )}
                        {p.tag && <span className="text-[10px] text-indigo-400 font-medium">#{p.tag}</span>}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
                    <div className={`px-2.5 py-0.5 rounded-full text-[11px] font-medium border flex items-center gap-1.5 ${statusColor}`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${p.status === 'online' ? 'bg-emerald-400 animate-pulse' : p.status === 'offline' ? 'bg-red-400' : 'bg-amber-400'}`} />
                      <span className="capitalize">{p.status}</span>
                    </div>

                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="xs"
                        onClick={() => handleCheckSingle(p.id)}
                        disabled={isCheckingThis}
                        title="Проверить доступность"
                        icon={<RefreshCw size={13} className={isCheckingThis ? 'animate-spin text-amber-400' : ''} />}
                      />
                      <Button
                        variant="ghost"
                        size="xs"
                        onClick={() => handleDelete(p.id)}
                        title="Удалить прокси"
                        icon={<Trash2 size={13} className="text-red-400 hover:text-red-300" />}
                      />
                    </div>

                    <div className="pl-2 border-l border-[var(--theme-border)]" title={p.is_active ? 'Активен' : 'Отключен'}>
                      <Toggle
                        checked={p.is_active}
                        onChange={() => handleToggle(p.id, p.is_active)}
                        size="sm"
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </SettingsSection>
    </div>
  );
};
