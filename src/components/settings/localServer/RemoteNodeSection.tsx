import React, { useState } from 'react';
import { Cpu, Wifi, CheckCircle2, XCircle, RefreshCw, Laptop, ShieldCheck, Zap } from 'lucide-react';
import { Card, Button, Input, Badge, Toggle } from '../../ui';
import { AppConfig } from '../../../types';
import { useToast } from '../../../context/ToastContext';

interface RemoteNodeSectionProps {
  config: AppConfig | null;
  onSaveConfig: (updatedConfig: AppConfig) => Promise<void>;
}

export const RemoteNodeSection: React.FC<RemoteNodeSectionProps> = ({
  config,
  onSaveConfig,
}) => {
  const { showToast } = useToast();

  const [enabled, setEnabled] = useState(config?.remote_node?.enabled ?? false);
  const [host, setHost] = useState(config?.remote_node?.host || '192.168.1.100');
  const [port, setPort] = useState(config?.remote_node?.port || 11434);
  const [probing, setProbing] = useState(false);
  const [probeResult, setProbeResult] = useState<{
    online: boolean;
    latencyMs?: number;
    model?: string;
    error?: string;
  } | null>(null);

  const handleProbe = async () => {
    setProbing(true);
    const start = Date.now();
    try {
      const res = await fetch(`http://${host}:${port}/health`);
      const latencyMs = Date.now() - start;
      if (res.ok) {
        let data: any = {};
        try { data = await res.json(); } catch {}
        setProbeResult({
          online: true,
          latencyMs,
          model: data.model || 'Llama Server / Remote GPU Ready',
        });
        showToast(`GPU Node доступна (${latencyMs}ms)`, 'success');
      } else {
        setProbeResult({
          online: false,
          latencyMs,
          error: `HTTP ${res.status}`,
        });
        showToast(`Node ответила ошибкой HTTP ${res.status}`, 'warning');
      }
    } catch (err: any) {
      setProbeResult({
        online: false,
        latencyMs: Date.now() - start,
        error: err?.message || 'Connection refused',
      });
      showToast(`Не удалось подключиться к ${host}:${port}`, 'error');
    } finally {
      setProbing(false);
    }
  };

  const handleSave = async () => {
    if (!config) return;
    try {
      await onSaveConfig({
        ...config,
        remote_node: {
          ...config.remote_node,
          enabled,
          host: host.trim(),
          port: Number(port),
          auto_probe: true,
        },
      });
      showToast('Настройки Remote Compute Node сохранены', 'success');
    } catch (err: any) {
      showToast(`Ошибка сохранения: ${err?.message || err}`, 'error');
    }
  };

  return (
    <div className="space-y-6">
      {/* 1. Header Card */}
      <div className="flex items-center justify-between gap-3 bg-[var(--theme-card-bg)] p-4 rounded-2xl border border-[var(--theme-border)]">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-[var(--theme-accent)]/10 text-[var(--theme-accent)] border border-[var(--theme-accent)]/20">
            <Cpu size={18} />
          </div>
          <div>
            <h3 className="text-sm font-bold text-[var(--theme-text)]">Remote Compute Node (LAN Workstation)</h3>
            <p className="text-xs text-[var(--theme-text-muted)]">
              Делегирование тяжелого инференса LLM на мощную рабочую станцию в локальной сети (LAN)
            </p>
          </div>
        </div>

        {probeResult && (
          <Badge
            variant={probeResult.online ? 'success' : 'danger'}
            icon={probeResult.online ? <CheckCircle2 size={12} /> : <XCircle size={12} />}
          >
            {probeResult.online ? `Online (${probeResult.latencyMs}ms)` : 'Offline'}
          </Badge>
        )}
      </div>

      {/* 2. Configuration & Probe Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card variant="default" className="p-5 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-[var(--theme-border)]">
            <div className="flex items-center gap-2">
              <Wifi size={16} className="text-[var(--theme-accent)]" />
              <h4 className="text-xs font-bold uppercase tracking-wider text-[var(--theme-text)]">Сетевое подключение к GPU</h4>
            </div>
            <Toggle
              checked={enabled}
              onChange={setEnabled}
              label={enabled ? 'Включено' : 'Выключено'}
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-[var(--theme-text)] block mb-1.5">
              IP-адрес или Hostname рабочей станции
            </label>
            <Input
              value={host}
              onChange={(e) => setHost(e.target.value)}
              placeholder="192.168.1.100 или workstation.local"
            />
            <p className="text-[11px] text-[var(--theme-text-muted)] mt-1">
              Локальный IP-адрес компьютера с дискретной GPU в вашей домашней или офисной сети.
            </p>
          </div>

          <div>
            <label className="text-xs font-semibold text-[var(--theme-text)] block mb-1.5">
              Порт сервера инференса
            </label>
            <Input
              type="number"
              value={port.toString()}
              onChange={(e) => setPort(Number(e.target.value))}
              placeholder="11434 или 8080"
            />
            <p className="text-[11px] text-[var(--theme-text-muted)] mt-1">
              Обычно 8080 для llama-server, 11434 для Ollama или 5000 для vLLM.
            </p>
          </div>

          <div className="flex items-center gap-3 pt-2">
            <Button
              variant="secondary"
              onClick={handleProbe}
              disabled={probing}
              icon={<RefreshCw size={14} className={probing ? 'animate-spin' : ''} />}
            >
              {probing ? 'Проверка...' : 'Проверить связь'}
            </Button>
            <Button variant="primary" onClick={handleSave}>
              Сохранить параметры
            </Button>
          </div>
        </Card>

        {/* 3. Diagnostic & Status Card */}
        <Card variant="default" className="p-5 space-y-4 flex flex-col justify-between">
          <div className="space-y-3">
            <div className="flex items-center gap-2 pb-3 border-b border-[var(--theme-border)]">
              <ShieldCheck size={16} className="text-[var(--theme-accent)]" />
              <h4 className="text-xs font-bold uppercase tracking-wider text-[var(--theme-text)]">Статус узла инференса</h4>
            </div>

            <div className="p-3.5 rounded-xl bg-[var(--theme-input-bg)] border border-[var(--theme-border)] space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-[var(--theme-text-muted)]">Целевой узел:</span>
                <span className="font-mono text-[var(--theme-text)]">{host}:{port}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[var(--theme-text-muted)]">Состояние сети:</span>
                <span className={`font-semibold ${probeResult?.online ? 'text-emerald-400' : 'text-amber-400'}`}>
                  {probeResult?.online ? 'Подключено (LAN)' : probeResult ? 'Недоступно' : 'Не тестировалось'}
                </span>
              </div>
              {probeResult?.latencyMs !== undefined && (
                <div className="flex justify-between">
                  <span className="text-[var(--theme-text-muted)]">Задержка сети (Ping):</span>
                  <span className="font-mono text-[var(--theme-text)]">{probeResult.latencyMs} ms</span>
                </div>
              )}
              {probeResult?.error && (
                <div className="pt-2 text-red-400 border-t border-[var(--theme-border)]">
                  Ошибка: {probeResult.error}
                </div>
              )}
            </div>
          </div>

          <div className="p-3 rounded-xl bg-[var(--theme-accent)]/5 border border-[var(--theme-accent)]/15 text-[11px] text-[var(--theme-text-muted)] flex items-start gap-2">
            <Zap size={14} className="text-[var(--theme-accent)] shrink-0 mt-0.5" />
            <span>
              Слабый ноутбук может работать 24/7 круглосуточно с минимальным энергопотреблением, автоматически перенаправляя генерацию токенов на ПК с мощной видеокартой.
            </span>
          </div>
        </Card>
      </div>

      {/* 4. LAN Setup Guide */}
      <Card variant="default" className="p-5 space-y-3">
        <div className="flex items-center gap-2 pb-2 border-b border-[var(--theme-border)]">
          <Laptop size={16} className="text-[var(--theme-accent)]" />
          <h4 className="text-xs font-bold uppercase tracking-wider text-[var(--theme-text)]">Инструкция по запуску на основном ПК (GPU)</h4>
        </div>
        <p className="text-xs text-[var(--theme-text-muted)]">
          Чтобы запустить сервер инференса на основном ПК для доступа по локальной сети:
        </p>
        <div className="p-3 bg-black/40 rounded-xl font-mono text-xs text-emerald-400 border border-white/10 overflow-x-auto">
          llama-server.exe -m path\to\model.gguf --host 0.0.0.0 --port {port} -ngl 99 -fa on
        </div>
        <p className="text-[11px] text-[var(--theme-text-muted)]">
          Флаг <code className="text-[var(--theme-accent)]">--host 0.0.0.0</code> разрешает входящие подключения с ноутбука в домашней сети.
        </p>
      </Card>
    </div>
  );
};
