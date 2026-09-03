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
  Network,
  Cpu,
  HelpCircle,
  Lock,
} from 'lucide-react';
import { ProxyItem, ProxyProtocol, ProxyRoutingConfig } from '../../types';
import * as api from '../../services/api';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { Card } from '../ui/Card';
import { Toggle } from '../ui/Toggle';
import { SettingsHeader, SettingsSection } from './common';

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

      {/* Traffic Routing Matrix (Матрица маршрутизации) */}
      <Card className="p-4 bg-[var(--theme-card-bg)] border border-[var(--theme-border)] rounded-xl space-y-4">
        <div className="flex items-center justify-between border-b border-[var(--theme-border)] pb-3">
          <div>
            <h3 className="text-sm font-bold text-[var(--theme-text)] flex items-center gap-2">
              <Zap size={16} className="text-indigo-400" />
              Матрица направления трафика (Target Routing Matrix)
            </h3>
            <p className="text-xs text-[var(--theme-text-muted)] mt-0.5">
              Выберите, какие подсистемы 0xAgent направляют трафик через прокси, а какие работают напрямую.
            </p>
          </div>
          <Button
            variant="ghost"
            size="xs"
            onClick={() => setShowCheatSheet(!showCheatSheet)}
            icon={<HelpCircle size={14} />}
          >
            {showCheatSheet ? 'Скрыть памятку' : 'Шпаргалка'}
          </Button>
        </div>

        {/* Matrix Rows */}
        <div className="divide-y divide-[var(--theme-border)]">
          {/* 1. Cloud AI & STT */}
          <div className="py-3 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-indigo-500/10 text-indigo-400">
                <Shield size={16} />
              </div>
              <div>
                <div className="text-xs font-semibold text-[var(--theme-text)]">
                  Облачные AI &amp; STT (Groq Whisper, OpenAI API, Anthropic)
                </div>
                <div className="text-[11px] text-[var(--theme-text-muted)]">
                  Обход геоблокировок Cloudflare (ошибки 403) для транскрибации речи и облачных моделей.
                </div>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Badge variant={routing.enabled && routing.route_cloud_ai ? 'success' : 'neutral'}>
                {routing.enabled && routing.route_cloud_ai ? 'Через прокси' : 'Direct'}
              </Badge>
              <Toggle
                checked={routing.route_cloud_ai}
                onChange={() => handleUpdateRouting({ route_cloud_ai: !routing.route_cloud_ai })}
                size="sm"
              />
            </div>
          </div>

          {/* 2. Web Search & Scraping */}
          <div className="py-3 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400">
                <Globe size={16} />
              </div>
              <div>
                <div className="text-xs font-semibold text-[var(--theme-text)]">
                  Веб-поиск &amp; Скрапинг (DuckDuckGo, SearXNG, Jina Reader)
                </div>
                <div className="text-[11px] text-[var(--theme-text-muted)]">
                  Используется фактчекером и поисковыми агентами. Защита от блокировок и капч.
                </div>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Badge variant={routing.enabled && routing.route_web_search ? 'success' : 'neutral'}>
                {routing.enabled && routing.route_web_search ? 'Через прокси' : 'Direct'}
              </Badge>
              <Toggle
                checked={routing.route_web_search}
                onChange={() => handleUpdateRouting({ route_web_search: !routing.route_web_search })}
                size="sm"
              />
            </div>
          </div>

          {/* 3. Media Downloaders */}
          <div className="py-3 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-pink-500/10 text-pink-400">
                <Network size={16} />
              </div>
              <div>
                <div className="text-xs font-semibold text-[var(--theme-text)]">
                  Медиа-загрузчики (yt-dlp, TikTok, YouTube Shorts, Reels)
                </div>
                <div className="text-[11px] text-[var(--theme-text-muted)]">
                  Сбор субтитров и медиапотоков при блокировках или ограничении скорости CDN.
                </div>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Badge variant={routing.enabled && routing.route_media_download ? 'success' : 'neutral'}>
                {routing.enabled && routing.route_media_download ? 'Через прокси' : 'Direct'}
              </Badge>
              <Toggle
                checked={routing.route_media_download}
                onChange={() => handleUpdateRouting({ route_media_download: !routing.route_media_download })}
                size="sm"
              />
            </div>
          </div>

          {/* 4. Local Neural Engines (Immutable Direct) */}
          <div className="py-3 flex items-center justify-between gap-4 opacity-75">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-[var(--theme-border-subtle)] text-[var(--theme-text-muted)]">
                <Cpu size={16} />
              </div>
              <div>
                <div className="text-xs font-semibold text-[var(--theme-text)] flex items-center gap-1.5">
                  <span>Локальные нейросети (llama-server, DirectML Qwen3, LAN Node)</span>
                  <Lock size={12} className="text-emerald-400" />
                </div>
                <div className="text-[11px] text-[var(--theme-text-muted)]">
                  Всегда работают напрямую на локальном хосте (127.0.0.1) с нулевой задержкой.
                </div>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Badge variant="neutral" className="text-emerald-400 border-emerald-500/30">
                Всегда Direct
              </Badge>
            </div>
          </div>
        </div>

        {/* Collapsible Architecture Cheat Sheet */}
        {showCheatSheet && (
          <div className="p-3.5 rounded-xl bg-[var(--theme-bg)] border border-[var(--theme-border)] text-xs space-y-2 mt-3">
            <div className="font-bold text-[var(--theme-text)] flex items-center gap-1.5">
              <span>📘 Памятка архитектуры 0xAgent: как устроен сетевой трафик</span>
            </div>
            <div className="text-[var(--theme-text-muted)] leading-relaxed space-y-1.5">
              <p>
                • <b>Зачем нужен прокси:</b> Серверы Groq, OpenAI и некоторые поисковики блокируют прямые подключения из РФ (ошибка 403 Access Denied).
              </p>
              <p>
                • <b>Как выбирается прокси:</b> Система в реальном времени мониторит задержку (ping) и автоматически направляет трафик на самую быструю живую ноду из пула (<i>Smart Auto-Rotation</i>).
              </p>
              <p>
                • <b>Безопасность локальных моделей:</b> Локальный сервер <code>llama-server</code> и инференс на твоей видеокарте RX 7800 XT изолированы от прокси и всегда работают локально на максимальной скорости.
              </p>
            </div>
          </div>
        )}
      </Card>

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
