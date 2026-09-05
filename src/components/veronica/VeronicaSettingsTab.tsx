import React, { useState, useEffect } from 'react';
import { Bot, Eye, EyeOff, Plus, Trash2, Sliders, Save, Sparkles, RefreshCw, Zap, ShieldCheck, Mic } from 'lucide-react';
import { Card, Button, Input, Select, Toggle, Badge } from '../ui';
import { AppConfig, VeronicaConfig } from '../../types';
import { useToast } from '../../context/ToastContext';
import * as api from '../../services/api';

interface VeronicaSettingsTabProps {
  config: AppConfig | null;
  onSaveConfig: (updatedConfig: AppConfig) => Promise<void>;
}

export const VeronicaSettingsTab: React.FC<VeronicaSettingsTabProps> = ({
  config,
  onSaveConfig,
}) => {
  const { showToast } = useToast();

  const veronicaCfg = config?.veronica || {};
  const [enabled, setEnabled] = useState(veronicaCfg.enabled !== false);
  const [telegramToken, setTelegramToken] = useState(veronicaCfg.telegram_token || '');
  const [showToken, setShowToken] = useState(false);
  const [whitelist, setWhitelist] = useState<number[]>(veronicaCfg.telegram_whitelist || []);
  const [newUserId, setNewUserId] = useState('');
  const [autonomyLevel, setAutonomyLevel] = useState(veronicaCfg.default_autonomy_level || 'L2');
  const [watchdogInterval, setWatchdogInterval] = useState(veronicaCfg.watchdog_interval_sec || 15);
  const [heartbeatTimeout, setHeartbeatTimeout] = useState(veronicaCfg.default_heartbeat_timeout_sec || 300);
  const [cliPath, setCliPath] = useState(veronicaCfg.antigravity_cli_path || 'agy');
  const [model, setModel] = useState(veronicaCfg.model || 'inherit');
  const [effort, setEffort] = useState(veronicaCfg.effort || 'auto');
  const [agent, setAgent] = useState(veronicaCfg.agent || 'default');
  const [sttEngine, setSttEngine] = useState(veronicaCfg.stt_engine || 'auto');
  const [availableModels, setAvailableModels] = useState<{ local: string[]; antigravity: { slug: string; name: string; effort?: string }[] }>({ local: [], antigravity: [] });
  const [availableAgents, setAvailableAgents] = useState<{ slug: string; name: string; description?: string }[]>([]);
  const [saving, setSaving] = useState(false);
  const [reloading, setReloading] = useState(false);
  const [lastReloaded, setLastReloaded] = useState<number | null>(null);

  useEffect(() => {
    api.get_veronica_models().then(setAvailableModels).catch(() => {});
    api.get_veronica_agents().then((res) => setAvailableAgents(res.agents || [])).catch(() => {});
  }, []);

  const handleHotReload = async () => {
    try {
      setReloading(true);
      const res = await api.reload_veronica_module();
      if (res.success) {
        setLastReloaded(res.timestamp || Date.now());
        showToast('Модуль Вероника успешно и бесшовно перезагружен (Graceful Hot-Reload)', 'success');
      } else {
        showToast('Перезагрузка завершилась с предупреждением', 'warning');
      }
    } catch (err: any) {
      showToast(`Ошибка перезагрузки: ${err?.message || err}`, 'error');
    } finally {
      setReloading(false);
    }
  };

  const handleAddWhitelistUser = () => {
    const num = parseInt(newUserId.trim(), 10);
    if (!isNaN(num) && !whitelist.includes(num)) {
      setWhitelist([...whitelist, num]);
      setNewUserId('');
    }
  };

  const handleRemoveWhitelistUser = (id: number) => {
    setWhitelist(whitelist.filter((uid) => uid !== id));
  };

  const handleSave = async () => {
    if (!config) return;
    setSaving(true);
    try {
      const updatedVeronica: VeronicaConfig = {
        enabled,
        telegram_token: telegramToken.trim() || null,
        telegram_whitelist: whitelist,
        default_autonomy_level: autonomyLevel as any,
        watchdog_interval_sec: Number(watchdogInterval),
        default_heartbeat_timeout_sec: Number(heartbeatTimeout),
        antigravity_cli_path: cliPath.trim() || 'agy',
        model: model !== 'inherit' ? model : null,
        effort: effort !== 'auto' ? effort as any : null,
        agent: agent !== 'default' ? agent : null,
        stt_engine: (sttEngine || 'auto') as any,
      };

      await onSaveConfig({
        ...config,
        veronica: updatedVeronica,
      });
      showToast('Настройки модуля Вероника успешно сохранены', 'success');
    } catch (err: any) {
      showToast(`Ошибка сохранения: ${err?.message || err}`, 'error');
    } finally {
      setSaving(false);
    }
  };

  const modelOptions = [
    { value: 'inherit', label: 'Default / Auto (Inherit Host Model)' },
    ...availableModels.antigravity.map((m) => ({
      value: m.slug,
      label: `⚡ ${m.name}`,
    })),
    ...availableModels.local.map((m) => ({
      value: m,
      label: `🧠 Local: ${m}`,
    })),
  ];

  const agentOptions = [
    { value: 'default', label: 'Default General Agent' },
    ...availableAgents.map((a) => ({
      value: a.slug,
      label: `🤖 ${a.name}`,
    })),
  ];

  return (
    <div className="space-y-6">
      {/* Header Save Strip */}
      <div className="flex items-center justify-between gap-3 bg-[var(--theme-card-bg)] p-4 rounded-2xl border border-[var(--theme-border)]">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-[var(--theme-accent)]/10 text-[var(--theme-accent)] border border-[var(--theme-accent)]/20">
            <Bot size={18} />
          </div>
          <div>
            <h3 className="text-sm font-bold text-[var(--theme-text)]">Настройки Персонального Ассистента</h3>
            <p className="text-xs text-[var(--theme-text-muted)]">Конфигурация Telegram-бота, моделей и параметров выполнения</p>
          </div>
        </div>

        <Button
          variant="primary"
          size="sm"
          onClick={handleSave}
          disabled={saving}
          icon={<Save size={13} />}
        >
          {saving ? 'Сохранение...' : 'Сохранить настройки'}
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
        {/* Model, Effort & Agent Runtime Configuration */}
        <Card className="p-6 space-y-5">
          <div className="border-b border-[var(--theme-border)] pb-3">
            <h4 className="text-sm font-bold text-[var(--theme-text)] flex items-center gap-2">
              <Sparkles size={16} className="text-[var(--theme-accent)]" />
              <span>Движок, Модели & Субагенты</span>
            </h4>
          </div>

          <div className="space-y-4">
            <Select
              label="Модель по умолчанию (--model)"
              value={model}
              onChange={(e) => setModel(e.target.value)}
              options={modelOptions}
            />
            <p className="text-[11px] text-[var(--theme-text-muted)]">
              Определяет модель для запуска через Antigravity CLI или локальный сервер.
            </p>

            <Select
              label="Уровень рассуждений по умолчанию (--effort)"
              value={effort}
              onChange={(e) => setEffort(e.target.value as any)}
              options={[
                { value: 'auto', label: 'Auto / По умолчанию' },
                { value: 'low', label: 'Low — Минимальное время размышлений' },
                { value: 'medium', label: 'Medium — Сбалансированный режим' },
                { value: 'high', label: 'High — Глубокий анализ задач' },
              ]}
            />

            <Select
              label="Специализированный Агент (--agent)"
              value={agent}
              onChange={(e) => setAgent(e.target.value)}
              options={agentOptions}
            />

            <div className="pt-1">
              <Select
                label="Движок транскрибации речи (STT)"
                prefixIcon={<Mic size={14} className="text-[var(--theme-accent)]" />}
                value={sttEngine}
                onChange={(e) => setSttEngine(e.target.value as any)}
                options={[
                  { value: 'auto', label: '⚡ Авто: Qwen3-ASR (локально) ➜ Groq Cloud ➜ Vosk' },
                  { value: 'local', label: '🧠 Локальный STT (0xVoice2Text / Qwen3-ASR DirectML)' },
                  { value: 'groq', label: '☁️ Groq Cloud (Whisper Large v3 Turbo через 0xProxy)' },
                  { value: 'vosk', label: '📦 Vosk Offline (Локальный легкий STT)' },
                ]}
              />
              <p className="text-[11px] text-[var(--theme-text-muted)] mt-1">
                Используется для голосовых сообщений и кружочков в Telegram. При выборе облачного Groq запросы идут через локальный шлюз 0xProxy.
              </p>
            </div>

            <Input
              label="Команда / Путь Antigravity CLI"
              placeholder="agy"
              value={cliPath}
              onChange={(e) => setCliPath(e.target.value)}
            />
          </div>
        </Card>

        {/* Telegram Bot Settings */}
        <Card className="p-6 space-y-5">
          <div className="flex items-center justify-between border-b border-[var(--theme-border)] pb-3">
            <h4 className="text-sm font-bold text-[var(--theme-text)] flex items-center gap-2">
              <Bot size={16} className="text-[var(--theme-accent)]" />
              <span>Telegram Бот & Доступ</span>
            </h4>
            <Toggle
              checked={enabled}
              onChange={setEnabled}
              label="Модуль активен"
            />
          </div>

          <div className="space-y-3">
            <div className="relative">
              <Input
                label="Telegram Bot Token"
                type={showToken ? 'text' : 'password'}
                placeholder="123456789:ABCdefGhIJKlmNoPQRsTUVwxyZ"
                value={telegramToken}
                onChange={(e) => setTelegramToken(e.target.value)}
              />
              <button
                type="button"
                onClick={() => setShowToken(!showToken)}
                className="absolute right-3 top-8 text-[var(--theme-text-muted)] hover:text-[var(--theme-text)] cursor-pointer"
                title={showToken ? 'Скрыть' : 'Показать'}
              >
                {showToken ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>
            <p className="text-[11px] text-[var(--theme-text-muted)]">
              Токен создается через <code className="px-1 py-0.5 rounded bg-[var(--theme-border-subtle)]">@BotFather</code> в Telegram.
            </p>

            {/* Whitelist User IDs */}
            <div className="pt-2">
              <label className="block text-xs font-bold text-[var(--theme-text-muted)] mb-1.5">
                Белый список Telegram User IDs (Whitelist)
              </label>
              <div className="flex items-center gap-2 mb-2">
                <Input
                  placeholder="ID пользователя (например: 123456789)"
                  value={newUserId}
                  onChange={(e) => setNewUserId(e.target.value)}
                />
                <Button variant="secondary" size="sm" onClick={handleAddWhitelistUser} icon={<Plus size={13} />}>
                  Добавить
                </Button>
              </div>

              {whitelist.length > 0 ? (
                <div className="flex flex-wrap gap-1.5 p-2 bg-[var(--theme-panel)] rounded-xl border border-[var(--theme-border)]">
                  {whitelist.map((uid) => (
                    <Badge key={uid} variant="neutral" className="flex items-center gap-1">
                      <span>{uid}</span>
                      <button
                        type="button"
                        onClick={() => handleRemoveWhitelistUser(uid)}
                        className="text-red-400 hover:text-red-300 ml-1 cursor-pointer"
                      >
                        <Trash2 size={11} />
                      </button>
                    </Badge>
                  ))}
                </div>
              ) : (
                <p className="text-[11px] text-[var(--theme-text-muted)] italic">
                  Белый список пуст. Любой пользователь получит отказ в доступе со своим ID.
                </p>
              )}
            </div>
          </div>
        </Card>

        {/* Watchdog & Autonomy Bounds */}
        <Card className="p-6 space-y-5 md:col-span-2">
          <div className="border-b border-[var(--theme-border)] pb-3">
            <h4 className="text-sm font-bold text-[var(--theme-text)] flex items-center gap-2">
              <Sliders size={16} className="text-[var(--theme-accent)]" />
              <span>Безопасность, Автономность & Watchdog</span>
            </h4>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Select
              label="Уровень автономности"
              value={autonomyLevel}
              onChange={(e) => setAutonomyLevel(e.target.value as any)}
              options={[
                { value: 'L0', label: 'L0 — Только чтение и анализ' },
                { value: 'L1', label: 'L1 — Анализ и предложения' },
                { value: 'L2', label: 'L2 — Правка файлов и тесты' },
                { value: 'L3', label: 'L3 — Авто-коммиты в Git' },
                { value: 'L4', label: 'L4 — Авто-Merge веток' },
                { value: 'L5', label: 'L5 — Автономный Deploy' },
              ]}
            />

            <Input
              label="Интервал проверки Watchdog (сек)"
              type="number"
              value={String(watchdogInterval)}
              onChange={(e) => setWatchdogInterval(Number(e.target.value))}
            />

            <Input
              label="Таймаут Heartbeat (сек)"
              type="number"
              value={String(heartbeatTimeout)}
              onChange={(e) => setHeartbeatTimeout(Number(e.target.value))}
            />
          </div>
        </Card>

        {/* Graceful Hot-Reload Card */}
        <Card className="p-6 space-y-4 md:col-span-2 bg-[var(--theme-panel)] border border-[var(--theme-border)]">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[var(--theme-border)] pb-3">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-blue-500/10 text-blue-400 border border-blue-500/20">
                <Zap size={18} />
              </div>
              <div>
                <h4 className="text-sm font-bold text-[var(--theme-text)]">
                  Graceful Hot-Reload Модуля
                </h4>
                <p className="text-xs text-[var(--theme-text-muted)]">
                  Бесшовная горячая перезагрузка БД, воркеров и Telegram-бота без прерывания 0xAgent и LLM сервера
                </p>
              </div>
            </div>

            <Button
              variant="secondary"
              size="sm"
              onClick={handleHotReload}
              disabled={reloading}
              icon={<RefreshCw size={13} className={reloading ? 'animate-spin' : ''} />}
            >
              {reloading ? 'Перезагрузка...' : 'Горячая перезагрузка (Hot-Reload)'}
            </Button>
          </div>

          <div className="flex items-center justify-between text-xs text-[var(--theme-text-muted)] font-mono">
            <div className="flex items-center gap-1.5">
              <ShieldCheck size={14} className="text-emerald-400" />
              <span>Изолированная архитектура :: Zero Downtime Invariant</span>
            </div>
            {lastReloaded && (
              <span>Последняя перезагрузка: {new Date(lastReloaded).toLocaleTimeString()}</span>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
};
