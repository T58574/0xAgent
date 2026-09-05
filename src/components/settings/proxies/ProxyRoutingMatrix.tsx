import React from 'react';
import { Card } from '../../ui/Card';
import { Button } from '../../ui/Button';
import { Toggle } from '../../ui/Toggle';
import { Badge } from '../../ui/Badge';
import { Zap, Shield, Globe, Network, Cpu, Lock, HelpCircle } from 'lucide-react';
import { ProxyRoutingConfig } from '../../../types';

interface ProxyRoutingMatrixProps {
  routing: ProxyRoutingConfig;
  onUpdateRouting: (changes: Partial<ProxyRoutingConfig>) => void;
  showCheatSheet: boolean;
  onToggleCheatSheet: () => void;
}

export const ProxyRoutingMatrix: React.FC<ProxyRoutingMatrixProps> = ({
  routing,
  onUpdateRouting,
  showCheatSheet,
  onToggleCheatSheet,
}) => {
  return (
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
          onClick={onToggleCheatSheet}
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
              onChange={() => onUpdateRouting({ route_cloud_ai: !routing.route_cloud_ai })}
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
              onChange={() => onUpdateRouting({ route_web_search: !routing.route_web_search })}
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
              onChange={() => onUpdateRouting({ route_media_download: !routing.route_media_download })}
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
  );
};
