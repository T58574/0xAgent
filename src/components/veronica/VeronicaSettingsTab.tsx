import React, { useState } from 'react';
import { Bot, Eye, EyeOff, Plus, Trash2, Sliders, Save } from 'lucide-react';
import { Card, Button, Input, Select, Toggle, Badge } from '../ui';
import { AppConfig, VeronicaConfig } from '../../types';
import { useToast } from '../../context/ToastContext';

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
  const [saving, setSaving] = useState(false);

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
            <p className="text-xs text-[var(--theme-text-muted)]">Конфигурация Telegram-бота, безопасности и таймаутов</p>
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

        {/* Watchdog & Execution Bounds */}
        <Card className="p-6 space-y-5">
          <div className="border-b border-[var(--theme-border)] pb-3">
            <h4 className="text-sm font-bold text-[var(--theme-text)] flex items-center gap-2">
              <Sliders size={16} className="text-[var(--theme-accent)]" />
              <span>Безопасность & Параметры Watchdog</span>
            </h4>
          </div>

          <div className="space-y-4">
            <Select
              label="Уровень автономности по умолчанию"
              value={autonomyLevel}
              onChange={(e) => setAutonomyLevel(e.target.value as any)}
              options={[
                { value: 'L0', label: 'L0 — Только чтение и анализ' },
                { value: 'L1', label: 'L1 — Анализ и генерация предложений' },
                { value: 'L2', label: 'L2 — Изменение файлов и тесты (По умолчанию)' },
                { value: 'L3', label: 'L3 — Автоматическое создание Git коммитов' },
                { value: 'L4', label: 'L4 — Автоматический Merge веток' },
                { value: 'L5', label: 'L5 — Автономный Production Deploy' },
              ]}
            />

            <Input
              label="Интервал проверки Watchdog (секунды)"
              type="number"
              value={String(watchdogInterval)}
              onChange={(e) => setWatchdogInterval(Number(e.target.value))}
            />

            <Input
              label="Таймаут отсутствия Heartbeat (секунды)"
              type="number"
              value={String(heartbeatTimeout)}
              onChange={(e) => setHeartbeatTimeout(Number(e.target.value))}
            />

            <Input
              label="Команда / Путь Antigravity CLI"
              placeholder="agy"
              value={cliPath}
              onChange={(e) => setCliPath(e.target.value)}
            />
          </div>
        </Card>
      </div>
    </div>
  );
};
