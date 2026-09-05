import React, { useState, useEffect, useCallback } from 'react';
import {
  Plus,
  RefreshCw,
  Copy,
  Check,
  Globe,
  Zap,
  Network,
  CheckCircle2,
  XCircle,
  Shield,
} from 'lucide-react';
import { ProxyItem, ProxyProtocol, ProxyRoutingConfig } from '../../types';
import * as api from '../../services/api';
import { Button } from '../ui/Button';
import { Card } from '../ui/Card';
import { Toggle } from '../ui/Toggle';
import { SettingsHeader, SettingsSection } from './common';
import { ProxyRoutingMatrix } from './proxies/ProxyRoutingMatrix';
import { ProxyBatchImportModal } from './proxies/ProxyBatchImportModal';
import { ProxyRow } from './proxies/ProxyRow';

export const ProxiesTab: React.FC = () => {
  const [proxies, setProxies] = useState<ProxyItem[]>([]);
  const [routing, setRouting] = useState<ProxyRoutingConfig>({
    enabled: true,
    route_cloud_ai: true,
    route_web_search: true,
    route_media_download: true,
  });
  const [bestProxy, setBestProxy] = useState<ProxyItem | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [checkingAll, setCheckingAll] = useState<boolean>(false);
  const [checkingIds, setCheckingIds] = useState<Set<string>>(new Set());
  const [showAddForm, setShowAddForm] = useState<boolean>(false);
  const [showCheatSheet, setShowCheatSheet] = useState<boolean>(false);
  const [batchInput, setBatchInput] = useState<string>('');
  const [selectedProtocol, setSelectedProtocol] = useState<ProxyProtocol | ''>('');
  const [importMessage, setImportMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [copiedExport, setCopiedExport] = useState<boolean>(false);

  const fetchProxiesAndRouting = useCallback(async () => {
    try {
      setLoading(true);
      const [listRes, routingRes] = await Promise.all([
        api.list_proxies(),
        api.get_proxy_routing().catch(() => ({
          routing: { enabled: true, route_cloud_ai: true, route_web_search: true, route_media_download: true },
          bestProxy: null,
        })),
      ]);
      setProxies(listRes.proxies || []);
      if (routingRes?.routing) setRouting(routingRes.routing);
      if (routingRes?.bestProxy) setBestProxy(routingRes.bestProxy);
    } catch (err: any) {
      console.error('[ProxiesTab] Failed to load data:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProxiesAndRouting();
  }, [fetchProxiesAndRouting]);

  const handleUpdateRouting = async (changes: Partial<ProxyRoutingConfig>) => {
    const next = { ...routing, ...changes };
    setRouting(next);
    try {
      const res = await api.update_proxy_routing(changes);
      if (res?.routing) setRouting(res.routing);
      if (res?.bestProxy) setBestProxy(res.bestProxy);
    } catch (err) {
      console.error('[ProxiesTab] Error updating routing:', err);
    }
  };

  const handleCheckAll = async () => {
    try {
      setCheckingAll(true);
      await api.check_proxies();
      await fetchProxiesAndRouting();
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
      await fetchProxiesAndRouting();
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
      const rout = await api.get_proxy_routing().catch(() => null);
      if (rout?.bestProxy) setBestProxy(rout.bestProxy);
    } catch (err: any) {
      console.error(`[ProxiesTab] Error toggling proxy ${id}:`, err);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await api.delete_proxy(id);
      setProxies((prev) => prev.filter((p) => p.id !== id));
      const rout = await api.get_proxy_routing().catch(() => null);
      if (rout) setBestProxy(rout.bestProxy);
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
        await fetchProxiesAndRouting();
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

      {/* Live Active Gateway Banner */}
      <div
        className={`p-4 rounded-xl border flex flex-col md:flex-row items-start md:items-center justify-between gap-3 ${
          !routing.enabled
            ? 'bg-[var(--theme-panel)]/60 border-[var(--theme-border)] text-[var(--theme-text-muted)]'
            : bestProxy
            ? 'bg-emerald-500/10 border-emerald-500/30 text-[var(--theme-text)]'
            : 'bg-amber-500/10 border-amber-500/30 text-[var(--theme-text)]'
        }`}
      >
        <div className="flex items-center gap-3">
          <div
            className={`p-2.5 rounded-xl ${
              !routing.enabled
                ? 'bg-[var(--theme-border-subtle)] text-[var(--theme-text-muted)]'
                : bestProxy
                ? 'bg-emerald-500/20 text-emerald-400'
                : 'bg-amber-500/20 text-amber-400'
            }`}
          >
            <Network size={20} />
          </div>
          <div>
            <div className="text-xs font-semibold uppercase tracking-wider text-[var(--theme-text-muted)]">
              Текущий сетевой статус
            </div>
            <div className="text-sm font-bold flex items-center gap-2 mt-0.5">
              {!routing.enabled ? (
                <span>Прямой доступ (Direct Connection) — проксирование отключено</span>
              ) : bestProxy ? (
                <>
                  <span className="text-emerald-400">
                    🟢 Шлюз: {bestProxy.protocol.toUpperCase()} {bestProxy.host}:{bestProxy.port}
                  </span>
                  {bestProxy.latency_ms !== null && (
                    <span className="text-xs font-mono px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300">
                      {bestProxy.latency_ms} мс
                    </span>
                  )}
                </>
              ) : (
                <span className="text-amber-400">
                  ⚠️ Проксирование включено, но нет активных онлайн-нод в пуле
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs text-[var(--theme-text-muted)]">Глобальный мастер-шлюз:</span>
          <Toggle
            checked={routing.enabled}
            onChange={() => handleUpdateRouting({ enabled: !routing.enabled })}
            size="sm"
          />
        </div>
      </div>

      {/* Traffic Routing Matrix */}
      <ProxyRoutingMatrix
        routing={routing}
        onUpdateRouting={handleUpdateRouting}
        showCheatSheet={showCheatSheet}
        onToggleCheatSheet={() => setShowCheatSheet(!showCheatSheet)}
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

      {/* Add / Batch Import Modal Card */}
      {showAddForm && (
        <ProxyBatchImportModal
          batchInput={batchInput}
          setBatchInput={setBatchInput}
          selectedProtocol={selectedProtocol}
          setSelectedProtocol={setSelectedProtocol}
          importMessage={importMessage}
          onImport={handleAddBatch}
          onClose={() => setShowAddForm(false)}
        />
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
            {proxies.map((p) => (
              <ProxyRow
                key={p.id}
                proxy={p}
                isChecking={checkingIds.has(p.id)}
                onCheck={handleCheckSingle}
                onDelete={handleDelete}
                onToggle={handleToggle}
              />
            ))}
          </div>
        )}
      </SettingsSection>
    </div>
  );
};
