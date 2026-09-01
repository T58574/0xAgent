import React, { useState } from 'react';
import { Cpu, Wifi, CheckCircle2, XCircle, RefreshCw, Laptop } from 'lucide-react';
import { Card, Button, Input, Badge } from '../ui';
import { AppConfig } from '../../types';
import { useToast } from '../../context/ToastContext';

interface VeronicaComputeNodeTabProps {
  config: AppConfig | null;
  onSaveConfig: (updatedConfig: AppConfig) => Promise<void>;
}

export const VeronicaComputeNodeTab: React.FC<VeronicaComputeNodeTabProps> = ({
  config,
  onSaveConfig,
}) => {
  const { showToast } = useToast();
  const [host, setHost] = useState(config?.remote_node?.host || '127.0.0.1');
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
          model: data.model || 'Llama Server Ready',
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
          enabled: true,
          host: host.trim(),
          port: Number(port),
          auto_probe: true,
        },
      });
      showToast('Настройки Compute Node сохранены', 'success');
    } catch (err: any) {
      showToast(`Ошибка сохранения: ${err?.message || err}`, 'error');
    }
  };

  return (
    <div className="space-y-6">
      {/* Overview Card */}
      <div className="flex items-center justify-between gap-3 bg-[var(--theme-card-bg)] p-4 rounded-2xl border border-[var(--theme-border)]">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-[var(--theme-accent)]/10 text-[var(--theme-accent)] border border-[var(--theme-accent)]/20">
            <Cpu size={18} />
          </div>
          <div>
            <h3 className="text-sm font-bold text-[var(--theme-text)]">Remote Compute Node (Workstation)</h3>
            <p className="text-xs text-[var(--theme-text-muted)]">Делегирование инференса на мощную рабочую станцию в локальной сети (LAN)</p>
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

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
        {/* Node Connection Settings */}
        <Card className="p-6 space-y-4">
          <h4 className="text-sm font-bold text-[var(--theme-text)] flex items-center gap-2">
            <Wifi size={16} className="text-[var(--theme-accent)]" />
            <span>Параметры подключения в LAN</span>
          </h4>

          <div className="space-y-3">
            <Input
              label="IP адрес или mDNS имя рабочей станции"
              placeholder="например: 192.168.1.100 или workstation.local"
              value={host}
              onChange={(e) => setHost(e.target.value)}
            />

            <Input
              label="Порт llama-server"
              type="number"
              placeholder="11434"
              value={String(port)}
              onChange={(e) => setPort(Number(e.target.value))}
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-[var(--theme-border)]">
            <Button
              variant="secondary"
              size="sm"
              onClick={handleProbe}
              disabled={probing}
              icon={<RefreshCw size={13} className={probing ? 'animate-spin' : ''} />}
            >
              {probing ? 'Проверка...' : 'Проверить (Probe)'}
            </Button>
            <Button variant="primary" size="sm" onClick={handleSave}>
              Сохранить адрес
            </Button>
          </div>
        </Card>

        {/* 24/7 Setup Guide & Command Card */}
        <Card className="p-6 space-y-4">
          <h4 className="text-sm font-bold text-[var(--theme-text)] flex items-center gap-2">
            <Laptop size={16} className="text-[var(--theme-accent)]" />
            <span>Инструкция запуска на рабочей станции</span>
          </h4>

          <p className="text-xs text-[var(--theme-text-muted)] leading-relaxed">
            Чтобы ноутбук мог автономно работать 24/7, запустите инференс-сервер на мощном ПК с флагом привязки к локальной сети (<code className="px-1 py-0.5 rounded bg-[var(--theme-border-subtle)]">--host 0.0.0.0</code>):
          </p>

          <div className="p-3 bg-black/40 rounded-xl border border-[var(--theme-border)] font-mono text-[11px] text-[var(--theme-text)] leading-relaxed select-all">
            llama-server.exe --host 0.0.0.0 --port 11434 -m "C:\models\Qwen2.5-Coder-32B.gguf" -fa on -ctk q8_0 -ctv q8_0 -ngl 99
          </div>

          <div className="p-3 bg-[var(--theme-panel)] rounded-xl border border-[var(--theme-border)] text-xs text-[var(--theme-text-muted)] space-y-1">
            <strong className="text-[var(--theme-text)] block">Совет по отказоустойчивости:</strong>
            <span>Если рабочая станция будет выключена, 0xAgent выдаст понятное уведомление без зависания платформы.</span>
          </div>
        </Card>
      </div>
    </div>
  );
};
