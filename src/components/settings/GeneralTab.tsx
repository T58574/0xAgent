import React, { useState } from 'react';
import { Sliders, Shield, Volume2, Save, LayoutGrid, Globe, Key, KeyRound, LogOut, CheckCircle2, AlertTriangle, Sparkles } from 'lucide-react';
import * as api from '../../services/api';

interface SettingToggleCardProps {
  icon: React.ReactNode;
  title: string;
  desc: string;
  active: boolean;
  onToggle: () => void;
}

const SettingToggleCard: React.FC<SettingToggleCardProps> = ({
  icon,
  title,
  desc,
  active,
  onToggle,
}) => (
  <div
    onClick={onToggle}
    className={`p-3.5 rounded-xl bento-card flex items-center justify-between cursor-pointer transition-all border ${
      active
        ? 'bg-white/10 border-white/20 text-[var(--theme-text)]'
        : 'bg-black/20 border-[var(--theme-border)] text-[var(--theme-text-muted)] hover:border-white/15'
    }`}
  >
    <div className="flex items-center gap-3 min-w-0 pr-2">
      <div
        className={`p-2 rounded-lg shrink-0 transition-colors ${
          active ? 'bg-white/15 text-white' : 'bg-white/5 text-[var(--theme-text-muted)]'
        }`}
      >
        {icon}
      </div>
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-[var(--theme-text)] truncate">{title}</span>
          <span
            className={`text-[9px] font-mono px-1.5 py-0.5 rounded transition-colors ${
              active
                ? 'bg-white/15 text-white font-bold border border-white/20'
                : 'bg-white/5 text-zinc-500 border border-white/5'
            }`}
          >
            {active ? '[ВКЛ]' : '[ВЫКЛ]'}
          </span>
        </div>
        <div className="text-[11px] text-[var(--theme-text-muted)] leading-tight mt-0.5">{desc}</div>
      </div>
    </div>
    <div
      className={`w-9 h-5 rounded-full p-0.5 flex items-center transition-colors shrink-0 ${
        active ? 'bg-white' : 'bg-white/15'
      }`}
    >
      <div
        className={`w-4 h-4 rounded-full transition-transform ${
          active ? 'translate-x-4 bg-black shadow-sm' : 'translate-x-0 bg-white/70'
        }`}
      />
    </div>
  </div>
);

interface GeneralTabProps {
  apiUrl: string;
  setApiUrl: (val: string) => void;
  groqApiKey: string;
  setGroqApiKey: (val: string) => void;
  geminiApiKey?: string;
  setGeminiApiKey?: (val: string) => void;
  reasoningEnabled: boolean;
  setReasoningEnabled: (val: boolean) => void;
  autoSaveHistory: boolean;
  setAutoSaveHistory: (val: boolean) => void;
  soundNotifications: boolean;
  setSoundNotifications: (val: boolean) => void;
  compactChat: boolean;
  setCompactChat: (val: boolean) => void;
  ttsVoiceEnabled?: boolean;
  setTtsVoiceEnabled?: (val: boolean) => void;
  ttsVoice?: string;
  setTtsVoice?: (val: string) => void;
  ttsRate?: string;
  setTtsRate?: (val: string) => void;
  ttsPlayOnSpeaker?: boolean;
  setTtsPlayOnSpeaker?: (val: boolean) => void;
  ttsPlayInBrowser?: boolean;
  setTtsPlayInBrowser?: (val: boolean) => void;
  wakeWordEnabled?: boolean;
  setWakeWordEnabled?: (val: boolean) => void;
  proactiveCompanionEnabled?: boolean;
  setProactiveCompanionEnabled?: (val: boolean) => void;
}

export const GeneralTab: React.FC<GeneralTabProps> = ({
  apiUrl,
  setApiUrl,
  groqApiKey,
  setGroqApiKey,
  geminiApiKey = '',
  setGeminiApiKey,
  reasoningEnabled,
  setReasoningEnabled,
  autoSaveHistory,
  setAutoSaveHistory,
  soundNotifications,
  setSoundNotifications,
  compactChat,
  setCompactChat,
  ttsVoiceEnabled = true,
  setTtsVoiceEnabled,
  ttsVoice = 'ru-RU-DmitryNeural',
  setTtsVoice,
  ttsRate = '+15%',
  setTtsRate,
  ttsPlayOnSpeaker = true,
  setTtsPlayOnSpeaker,
  ttsPlayInBrowser = true,
  setTtsPlayInBrowser,
  wakeWordEnabled = false,
  setWakeWordEnabled,
  proactiveCompanionEnabled = true,
  setProactiveCompanionEnabled,
}) => {
  // Password change state
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [statusMsg, setStatusMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [isSubmittingPassword, setIsSubmittingPassword] = useState(false);

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatusMsg(null);

    if (!currentPassword) {
      setStatusMsg({ type: 'error', text: 'Укажите текущий пароль' });
      return;
    }
    if (newPassword.trim().length < 4) {
      setStatusMsg({ type: 'error', text: 'Новый пароль должен содержать минимум 4 символа' });
      return;
    }
    if (newPassword !== confirmPassword) {
      setStatusMsg({ type: 'error', text: 'Новые пароли не совпадают' });
      return;
    }

    setIsSubmittingPassword(true);
    try {
      const res = await api.change_password(currentPassword, newPassword.trim());
      if (res.success) {
        setStatusMsg({ type: 'success', text: 'Мастер-пароль успешно изменён!' });
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
      } else {
        setStatusMsg({ type: 'error', text: res.error || 'Не удалось изменить пароль' });
      }
    } catch (err: any) {
      setStatusMsg({ type: 'error', text: `Ошибка: ${err.message || err}` });
    } finally {
      setIsSubmittingPassword(false);
    }
  };

  const handleLogout = async () => {
    await api.logout();
    window.location.reload();
  };

  return (
    <div className="space-y-4 font-sans text-[var(--theme-text)] max-w-4xl pb-6">
      <div>
        <h3 className="text-sm font-semibold text-[var(--theme-text)] flex items-center gap-2">
          <Sliders size={15} className="text-[var(--theme-text-muted)]" />
          <span>Основные параметры</span>
        </h3>
        <p className="text-xs text-[var(--theme-text-muted)] mt-0.5">
          Конфигурация подключения к API, поведение интерфейса и безопасность
        </p>
      </div>

      {/* 1. Connection Card */}
      <div className="p-4 rounded-xl bento-card space-y-3">
        <div className="text-xs font-medium text-[var(--theme-text)] flex items-center gap-1.5 border-b border-[var(--theme-border)] pb-2">
          <Globe size={13} className="text-[var(--theme-text-muted)]" />
          <span>Параметры API подключения</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {/* API Endpoint URL */}
          <div className="space-y-1">
            <label className="text-xs font-medium text-[var(--theme-text-muted)] flex items-center gap-1">
              <Globe size={12} />
              <span>Ссылка API</span>
            </label>
            <input
              type="text"
              value={apiUrl}
              onChange={(e) => setApiUrl(e.target.value)}
              placeholder="http://127.0.0.1:11434/v1"
              className="w-full px-3 py-2 rounded-lg bento-card text-xs font-mono text-[var(--theme-text)] focus:outline-none bg-black/40"
            />
          </div>

          {/* Google AI Studio (Gemini) API Key */}
          <div className="space-y-1">
            <label className="text-xs font-medium text-[var(--theme-text-muted)] flex items-center gap-1">
              <Key size={12} />
              <span>Google Gemini API Key</span>
            </label>
            <input
              type="password"
              value={geminiApiKey}
              onChange={(e) => setGeminiApiKey && setGeminiApiKey(e.target.value)}
              placeholder="AIzaSy..."
              className="w-full px-3 py-2 rounded-lg bento-card text-xs font-mono text-[var(--theme-text)] focus:outline-none bg-black/40"
            />
          </div>

          {/* Groq API Key */}
          <div className="space-y-1">
            <label className="text-xs font-medium text-[var(--theme-text-muted)] flex items-center gap-1">
              <Key size={12} />
              <span>Groq API Key (Whisper)</span>
            </label>
            <input
              type="password"
              value={groqApiKey}
              onChange={(e) => setGroqApiKey(e.target.value)}
              placeholder="gsk_..."
              className="w-full px-3 py-2 rounded-lg bento-card text-xs font-mono text-[var(--theme-text)] focus:outline-none bg-black/40"
            />
          </div>

        </div>
      </div>

      {/* 2. UI & Behavior Toggles */}
      <div className="p-4 rounded-xl bento-card space-y-3">
        <div className="text-xs font-medium text-[var(--theme-text)] flex items-center justify-between border-b border-[var(--theme-border)] pb-2">
          <div className="flex items-center gap-1.5">
            <Sliders size={14} className="text-[var(--theme-text-muted)]" />
            <span>Поведение и интерфейс</span>
          </div>
          <span className="text-[10px] font-mono text-[var(--theme-text-muted)] opacity-70">
            :: Preferences
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <SettingToggleCard
            icon={<Shield size={16} />}
            title="Цепочка рассуждений"
            desc="Отображать блок мыслей <think> в ответах"
            active={reasoningEnabled}
            onToggle={() => setReasoningEnabled(!reasoningEnabled)}
          />

          <SettingToggleCard
            icon={<Save size={16} />}
            title="Автосохранение истории"
            desc="Синхронизация истории диалогов на диск"
            active={autoSaveHistory}
            onToggle={() => setAutoSaveHistory(!autoSaveHistory)}
          />

          <SettingToggleCard
            icon={<Volume2 size={16} />}
            title="Звуковые сигналы"
            desc="Звук по завершению генерации ответа"
            active={soundNotifications}
            onToggle={() => setSoundNotifications(!soundNotifications)}
          />

          <SettingToggleCard
            icon={<LayoutGrid size={16} />}
            title="Компактный вид чата"
            desc="Уменьшенные отступы в сообщениях диалога"
            active={compactChat}
            onToggle={() => setCompactChat(!compactChat)}
          />
        </div>
      </div>

      {/* 3. Jarvis Voice Intercom & Proactive Companion */}
      <div className="p-4 rounded-xl bento-card space-y-4">
        <div className="flex items-center justify-between border-b border-[var(--theme-border)] pb-2">
          <div className="flex items-center gap-2 text-xs font-semibold text-[var(--theme-text)]">
            <Volume2 size={14} className="text-[var(--theme-text-muted)]" />
            <span>Голосовой интерком Jarvis и автономный напарник</span>
          </div>
          <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-white/5 text-[var(--theme-text-muted)] border border-[var(--theme-border)]">
            :: Push-Driven Engine
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <SettingToggleCard
            icon={<Volume2 size={16} />}
            title="Голосовой интерком (Edge-TTS)"
            desc="Короткие реплики вслух через системные динамики"
            active={Boolean(ttsVoiceEnabled)}
            onToggle={() => setTtsVoiceEnabled && setTtsVoiceEnabled(!ttsVoiceEnabled)}
          />

          <SettingToggleCard
            icon={<Sparkles size={16} />}
            title="Фоновый напарник Jarvis (Sparks)"
            desc="Генерация идей, аудит и предложения без спама"
            active={Boolean(proactiveCompanionEnabled)}
            onToggle={() => setProactiveCompanionEnabled && setProactiveCompanionEnabled(!proactiveCompanionEnabled)}
          />
        </div>

        {/* Voice Parameters */}
        {ttsVoiceEnabled && (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 border-t border-[var(--theme-border)]">
              <div>
                <label className="text-[11px] font-medium text-[var(--theme-text-muted)] block mb-1.5 font-mono">
                  Голос (Edge-TTS)
                </label>
                <select
                  value={ttsVoice}
                  onChange={(e) => setTtsVoice && setTtsVoice(e.target.value)}
                  className="w-full text-xs px-2.5 py-1.5 rounded-lg bg-black/40 border border-[var(--theme-border)] text-[var(--theme-text)] focus:outline-none focus:border-white/40"
                >
                  <option value="ru-RU-SvetlanaNeural" className="bg-black">Светлана (Женский, четкий)</option>
                  <option value="ru-RU-DmitryNeural" className="bg-black">Дмитрий (Мужской, глубокий)</option>
                </select>
              </div>

              <div>
                <label className="text-[11px] font-medium text-[var(--theme-text-muted)] block mb-1.5 font-mono">
                  Скорость речи
                </label>
                <select
                  value={ttsRate}
                  onChange={(e) => setTtsRate && setTtsRate(e.target.value)}
                  className="w-full text-xs px-2.5 py-1.5 rounded-lg bg-black/40 border border-[var(--theme-border)] text-[var(--theme-text)] focus:outline-none focus:border-white/40"
                >
                  <option value="+0%" className="bg-black">Стандартная (+0%)</option>
                  <option value="+15%" className="bg-black">Быстрая (+15%)</option>
                  <option value="+20%" className="bg-black">Оптимальная (+20%)</option>
                  <option value="+30%" className="bg-black">Ультра (+30%)</option>
                </select>
              </div>

              <div className="flex items-end">
                <button
                  type="button"
                  onClick={async () => {
                    try {
                      await api.speak_text('На связи, сэр. Все системы активны.', {
                        voice: ttsVoice,
                        rate: ttsRate,
                        playOnSpeaker: ttsPlayOnSpeaker,
                        category: 'greeting',
                      });
                    } catch (err: any) {
                      console.error('Voice test failed:', err);
                    }
                  }}
                  className="w-full flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/15 border border-[var(--theme-border)] text-xs text-[var(--theme-text)] transition-colors active:scale-95 cursor-pointer font-medium"
                >
                  <Volume2 size={13} className="text-[var(--theme-text)]" />
                  <span>Тест голоса</span>
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-[var(--theme-border)]">
              <label className="flex items-center gap-2.5 cursor-pointer text-xs text-[var(--theme-text-muted)] hover:text-[var(--theme-text)] select-none">
                <input
                  type="checkbox"
                  checked={ttsPlayOnSpeaker}
                  onChange={(e) => setTtsPlayOnSpeaker && setTtsPlayOnSpeaker(e.target.checked)}
                  className="rounded border-[var(--theme-border)] bg-black/40 text-white focus:ring-0 cursor-pointer"
                />
                <span>Воспроизводить через системные динамики (MCI)</span>
              </label>

              <label className="flex items-center gap-2.5 cursor-pointer text-xs text-[var(--theme-text-muted)] hover:text-[var(--theme-text)] select-none">
                <input
                  type="checkbox"
                  checked={ttsPlayInBrowser}
                  onChange={(e) => setTtsPlayInBrowser && setTtsPlayInBrowser(e.target.checked)}
                  className="rounded border-[var(--theme-border)] bg-black/40 text-white focus:ring-0 cursor-pointer"
                />
                <span>Воспроизводить в активной вкладке браузера</span>
              </label>

              <label className="flex items-center gap-2.5 cursor-pointer text-xs text-[var(--theme-text-muted)] hover:text-[var(--theme-text)] sm:col-span-2 select-none">
                <input
                  type="checkbox"
                  checked={wakeWordEnabled}
                  onChange={(e) => setWakeWordEnabled && setWakeWordEnabled(e.target.checked)}
                  className="rounded border-[var(--theme-border)] bg-black/40 text-white focus:ring-0 cursor-pointer"
                />
                <span>Бесконтактная активация голосом (Wake-Word «Джарвис»)</span>
              </label>
            </div>
          </>
        )}
      </div>

      {/* 3. Password & Session Security */}
      <div className="p-4 rounded-xl bento-card space-y-3">
        <div className="flex items-center justify-between border-b border-[var(--theme-border)] pb-2">
          <div className="flex items-center gap-2 text-xs font-medium text-[var(--theme-text)]">
            <KeyRound size={14} className="text-[var(--theme-text-muted)]" />
            <span>Мастер-пароль и безопасность</span>
          </div>

          <button
            type="button"
            onClick={handleLogout}
            className="px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/15 border border-[var(--theme-border)] text-xs text-[var(--theme-text-muted)] hover:text-[var(--theme-text)] flex items-center gap-1.5 cursor-pointer transition-colors"
            title="Сбросить токен авторизации в браузере"
          >
            <LogOut size={12} />
            <span>Выйти из сеанса</span>
          </button>
        </div>

        {statusMsg && (
          <div
            className={`p-2.5 rounded-lg border text-xs flex items-center gap-2 ${
              statusMsg.type === 'success'
                ? 'bg-white/10 border-[var(--theme-border)] text-[var(--theme-text)]'
                : 'bg-white/5 border-rose-500/40 text-rose-300'
            }`}
          >
            {statusMsg.type === 'success' ? (
              <CheckCircle2 size={14} className="shrink-0" />
            ) : (
              <AlertTriangle size={14} className="shrink-0" />
            )}
            <span>{statusMsg.text}</span>
          </div>
        )}

        <form onSubmit={handleChangePassword} className="space-y-3 pt-1">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-medium text-[var(--theme-text-muted)]">Текущий пароль</label>
              <input
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full px-3 py-2 rounded-lg bento-card text-xs font-mono text-[var(--theme-text)] bg-black/40 focus:outline-none"
                required
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium text-[var(--theme-text-muted)]">Новый пароль</label>
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Мин. 4 символа"
                className="w-full px-3 py-2 rounded-lg bento-card text-xs font-mono text-[var(--theme-text)] bg-black/40 focus:outline-none"
                required
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium text-[var(--theme-text-muted)]">Повторите пароль</label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full px-3 py-2 rounded-lg bento-card text-xs font-mono text-[var(--theme-text)] bg-black/40 focus:outline-none"
                required
              />
            </div>
          </div>

          <div className="flex justify-end pt-1">
            <button
              type="submit"
              disabled={isSubmittingPassword}
              className="px-3.5 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 border border-[var(--theme-border)] text-xs font-medium text-[var(--theme-text)] transition-colors cursor-pointer disabled:opacity-50"
            >
              {isSubmittingPassword ? 'Сохранение...' : 'Обновить пароль'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
