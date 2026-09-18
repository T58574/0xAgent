import React, { useState, useEffect, useCallback } from 'react';
import { Send, RefreshCw, Eye, EyeOff, ExternalLink, Shield, MessageSquare } from 'lucide-react';
import { useI18n } from '../../../i18n';
import { Button } from '../../ui/Button';
import { Input } from '../../ui/Input';
import { Card } from '../../ui/Card';
import { Badge } from '../../ui/Badge';
import { SettingsSection, SettingToggleCard } from '../common';
import * as api from '../../../services/api';
import { useToast } from '../../../context/ToastContext';

export interface TelegramSectionProps {
  telegramBotEnabled: boolean;
  setTelegramBotEnabled: (val: boolean) => void;
  telegramBotToken: string;
  setTelegramBotToken: (val: string) => void;
  telegramBotWhitelist: string;
  setTelegramBotWhitelist: (val: string) => void;
}

export const TelegramSection: React.FC<TelegramSectionProps> = ({
  telegramBotEnabled,
  setTelegramBotEnabled,
  telegramBotToken,
  setTelegramBotToken,
  telegramBotWhitelist,
  setTelegramBotWhitelist,
}) => {
  const { language } = useI18n();
  const { showToast } = useToast();

  const [isRunning, setIsRunning] = useState(false);
  const [botUsername, setBotUsername] = useState<string | null>(null);
  const [isRestarting, setIsRestarting] = useState(false);
  const [showToken, setShowToken] = useState(false);

  const fetchStatus = useCallback(async () => {
    try {
      const res = await api.get_telegram_status();
      setIsRunning(res.running);
      setBotUsername(res.username);
    } catch {
      setIsRunning(false);
      setBotUsername(null);
    }
  }, []);

  useEffect(() => {
    fetchStatus();
    const interval = setInterval(fetchStatus, 5000);
    return () => clearInterval(interval);
  }, [fetchStatus]);

  const handleRestartBot = async () => {
    setIsRestarting(true);
    try {
      const res = await api.restart_telegram_bot();
      setIsRunning(res.running);
      setBotUsername(res.username);
      if (res.running) {
        showToast(
          language === 'ru'
            ? `Telegram бот @${res.username || 'bot'} успешно запущен`
            : `Telegram bot @${res.username || 'bot'} started successfully`,
          'success'
        );
      } else {
        showToast(
          language === 'ru'
            ? 'Бот остановлен (проверьте токен или статус активности)'
            : 'Bot is stopped (check your token or enable flag)',
          'info'
        );
      }
    } catch (err: any) {
      showToast(err.message || 'Error restarting bot', 'error');
    } finally {
      setIsRestarting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Bot Master Toggle & Live Status Header */}
      <SettingsSection
        title={language === 'ru' ? 'Telegram Бот' : 'Telegram Bot'}
        description={
          language === 'ru'
            ? 'Прямое и защищенное подключение Telegram к вашему локальному серверу llama.cpp с поддержкой мультитерн-диалогов и голосовых сообщений'
            : 'Direct secure Telegram connection to your local llama.cpp server with multi-turn conversation memory and voice messaging'
        }
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <SettingToggleCard
            icon={<Send size={18} className="text-[var(--theme-accent)]" />}
            title={language === 'ru' ? 'Включить Telegram-бота' : 'Enable Telegram Bot'}
            desc={
              language === 'ru'
                ? 'Запускает локальный процесс Telegram бота при наличии токена'
                : 'Runs the local Telegram bot background listener when a token is provided'
            }
            active={telegramBotEnabled}
            onToggle={() => setTelegramBotEnabled(!telegramBotEnabled)}
          />

          <Card variant="default" className="p-4 flex items-center justify-between gap-3 rounded-2xl">
            <div className="space-y-1 min-w-0">
              <div className="text-xs font-bold text-[var(--theme-text)] flex items-center gap-2">
                <span>{language === 'ru' ? 'Статус бота:' : 'Bot Status:'}</span>
                {isRunning ? (
                  <Badge variant="success" size="sm" className="font-mono flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    {language === 'ru' ? 'ONLINE' : 'ONLINE'}
                  </Badge>
                ) : (
                  <Badge variant="neutral" size="sm" className="font-mono">
                    {language === 'ru' ? 'OFFLINE' : 'OFFLINE'}
                  </Badge>
                )}
              </div>
              <div className="text-[11px] text-[var(--theme-text-muted)] font-mono truncate">
                {botUsername ? (
                  <a
                    href={`https://t.me/${botUsername}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[var(--theme-accent)] hover:underline inline-flex items-center gap-1"
                  >
                    @{botUsername}
                    <ExternalLink size={10} />
                  </a>
                ) : (
                  <span>{language === 'ru' ? 'Не подключен' : 'Not connected'}</span>
                )}
              </div>
            </div>

            <Button
              variant="secondary"
              size="xs"
              onClick={handleRestartBot}
              disabled={isRestarting}
              loading={isRestarting}
              icon={<RefreshCw size={12} className={isRestarting ? 'animate-spin' : ''} />}
            >
              {language === 'ru' ? 'Перезапустить' : 'Restart'}
            </Button>
          </Card>
        </div>
      </SettingsSection>

      {/* Bot Credentials & Whitelist */}
      <SettingsSection
        title={language === 'ru' ? 'Параметры доступа и авторизации' : 'Credentials & Authorization'}
        description={
          language === 'ru'
            ? 'Укажите токен, полученный от @BotFather, и ограничьте доступ конкретным Telegram User ID для безопасности'
            : 'Configure token from @BotFather and whitelist your Telegram User ID for security'
        }
      >
        <Card variant="default" className="p-5 space-y-4 rounded-2xl">
          {/* Bot Token Input */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs font-bold text-[var(--theme-text)]">
              <label htmlFor="telegram-token">
                {language === 'ru' ? 'Токен Telegram-бота (Bot Token)' : 'Telegram Bot Token'}
              </label>
              <button
                type="button"
                onClick={() => setShowToken(!showToken)}
                className="text-[11px] text-[var(--theme-text-muted)] hover:text-[var(--theme-text)] flex items-center gap-1 cursor-pointer font-normal"
              >
                {showToken ? <EyeOff size={12} /> : <Eye size={12} />}
                <span>{showToken ? (language === 'ru' ? 'Скрыть' : 'Hide') : (language === 'ru' ? 'Показать' : 'Show')}</span>
              </button>
            </div>
            <Input
              id="telegram-token"
              type={showToken ? 'text' : 'password'}
              value={telegramBotToken}
              onChange={(e) => setTelegramBotToken(e.target.value)}
              placeholder="123456789:ABCdefGhIJKlmNoPQRsTUVwxyZ"
              className="font-mono text-xs"
            />
            <p className="text-[11px] text-[var(--theme-text-muted)] leading-relaxed">
              {language === 'ru'
                ? 'Создайте нового бота в Telegram через @BotFather (команда /newbot) и скопируйте предоставленный HTTP API Token.'
                : 'Create a new bot via @BotFather in Telegram (/newbot) and copy the provided HTTP API Token.'}
            </p>
          </div>

          {/* Whitelist Input */}
          <div className="space-y-1.5 pt-2 border-t border-[var(--theme-border)]">
            <div className="flex items-center justify-between text-xs font-bold text-[var(--theme-text)]">
              <label htmlFor="telegram-whitelist" className="flex items-center gap-1.5">
                <Shield size={13} className="text-[var(--theme-accent)]" />
                <span>{language === 'ru' ? 'Белый список User ID (Whitelist)' : 'Allowed User IDs (Whitelist)'}</span>
              </label>
              <span className="text-[10px] text-[var(--theme-text-muted)] font-mono">
                {language === 'ru' ? 'Через запятую' : 'Comma-separated'}
              </span>
            </div>
            <Input
              id="telegram-whitelist"
              type="text"
              value={telegramBotWhitelist}
              onChange={(e) => setTelegramBotWhitelist(e.target.value)}
              placeholder="12345678, 87654321"
              className="font-mono text-xs"
            />
            <p className="text-[11px] text-[var(--theme-text-muted)] leading-relaxed">
              {language === 'ru'
                ? 'Список числовых Telegram User ID через запятую. Узнать свой ID можно через бота @userinfobot. Если оставить поле пустым, бот сможет отвечать любому написавшему.'
                : 'Comma-separated list of numerical Telegram User IDs. Get your ID from @userinfobot. If left empty, any user with your bot link can interact.'}
            </p>
          </div>
        </Card>
      </SettingsSection>

      {/* Guide Card */}
      <Card variant="recessed" className="p-4 rounded-2xl space-y-2">
        <div className="text-xs font-bold text-[var(--theme-text)] flex items-center gap-2">
          <MessageSquare size={14} className="text-[var(--theme-accent)]" />
          <span>{language === 'ru' ? 'Возможности и команды в Telegram' : 'Capabilities & Commands'}</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-[11px] text-[var(--theme-text-muted)] pt-1">
          <div className="space-y-1">
            <div className="font-semibold text-[var(--theme-text)] flex items-center gap-1">
              <span className="font-mono text-[var(--theme-accent)]">/reset</span>
              <span>— {language === 'ru' ? 'Сброс контекста' : 'Reset Context'}</span>
            </div>
            <p>{language === 'ru' ? 'Очищает память текущего диалога с ботом для новой темы.' : 'Clears current conversation history for a fresh topic.'}</p>
          </div>
          <div className="space-y-1">
            <div className="font-semibold text-[var(--theme-text)] flex items-center gap-1">
              <span className="font-mono text-[var(--theme-accent)]">/status</span>
              <span>— {language === 'ru' ? 'Инфо о сервере' : 'Server Info'}</span>
            </div>
            <p>{language === 'ru' ? 'Показывает состояние llama.cpp и активную модель.' : 'Shows llama.cpp health status and currently loaded model.'}</p>
          </div>
          <div className="space-y-1">
            <div className="font-semibold text-[var(--theme-text)] flex items-center gap-1">
              <span className="font-mono text-[var(--theme-accent)]">/model</span>
              <span>— {language === 'ru' ? 'Активная модель' : 'Active Model'}</span>
            </div>
            <p>{language === 'ru' ? 'Показывает имя текущей загруженной модели локального сервера.' : 'Shows currently loaded model name on local server.'}</p>
          </div>
          <div className="space-y-1">
            <div className="font-semibold text-[var(--theme-text)] flex items-center gap-1">
              <Shield size={12} className="text-emerald-400" />
              <span>{language === 'ru' ? '100% Приватность' : '100% Local Privacy'}</span>
            </div>
            <p>{language === 'ru' ? 'Никаких облачных API. Ответы генерируются вашей локальной моделью.' : 'No cloud APIs. Responses generated strictly by your local LLM.'}</p>
          </div>
        </div>
      </Card>
    </div>
  );
};
