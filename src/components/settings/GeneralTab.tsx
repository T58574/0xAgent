import React, { useState } from 'react';
import { Sliders, Shield, Volume2, Save, LayoutGrid, Globe, Key, KeyRound, LogOut, CheckCircle2, AlertTriangle } from 'lucide-react';
import * as api from '../../services/api';

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
        <div className="text-xs font-medium text-[var(--theme-text)] flex items-center gap-1.5 border-b border-[var(--theme-border)] pb-2">
          <Sliders size={13} className="text-[var(--theme-text-muted)]" />
          <span>Поведение и интерфейс</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
          {/* Reasoning Toggle */}
          <div
            onClick={() => setReasoningEnabled(!reasoningEnabled)}
            className="p-3 rounded-lg bento-card flex items-center justify-between cursor-pointer hover:border-white/20 transition-colors"
          >
            <div className="flex items-center gap-2.5">
              <Shield size={16} className="text-[var(--theme-text-muted)]" />
              <div>
                <div className="text-xs font-medium text-[var(--theme-text)]">Отображать цепочку рассуждений</div>
                <div className="text-[11px] text-[var(--theme-text-muted)]">Показывать блок мыслей CoT в ответах</div>
              </div>
            </div>
            <div
              className={`w-9 h-5 rounded-md p-0.5 flex items-center transition-colors ${
                reasoningEnabled ? 'bg-white/30' : 'bg-white/10'
              }`}
            >
              <div className={`w-4 h-4 rounded-sm bg-white transition-transform ${reasoningEnabled ? 'translate-x-4' : 'translate-x-0'}`} />
            </div>
          </div>

          {/* Auto-Save History */}
          <div
            onClick={() => setAutoSaveHistory(!autoSaveHistory)}
            className="p-3 rounded-lg bento-card flex items-center justify-between cursor-pointer hover:border-white/20 transition-colors"
          >
            <div className="flex items-center gap-2.5">
              <Save size={16} className="text-[var(--theme-text-muted)]" />
              <div>
                <div className="text-xs font-medium text-[var(--theme-text)]">Автосохранение истории диалогов</div>
                <div className="text-[11px] text-[var(--theme-text-muted)]">Синхронизация сессий на локальный диск</div>
              </div>
            </div>
            <div
              className={`w-9 h-5 rounded-md p-0.5 flex items-center transition-colors ${
                autoSaveHistory ? 'bg-white/30' : 'bg-white/10'
              }`}
            >
              <div className={`w-4 h-4 rounded-sm bg-white transition-transform ${autoSaveHistory ? 'translate-x-4' : 'translate-x-0'}`} />
            </div>
          </div>

          {/* Sound Notifications */}
          <div
            onClick={() => setSoundNotifications(!soundNotifications)}
            className="p-3 rounded-lg bento-card flex items-center justify-between cursor-pointer hover:border-white/20 transition-colors"
          >
            <div className="flex items-center gap-2.5">
              <Volume2 size={16} className="text-[var(--theme-text-muted)]" />
              <div>
                <div className="text-xs font-medium text-[var(--theme-text)]">Звуковые сигналы</div>
                <div className="text-[11px] text-[var(--theme-text-muted)]">Звук по завершению генерации ответа</div>
              </div>
            </div>
            <div
              className={`w-9 h-5 rounded-md p-0.5 flex items-center transition-colors ${
                soundNotifications ? 'bg-white/30' : 'bg-white/10'
              }`}
            >
              <div className={`w-4 h-4 rounded-sm bg-white transition-transform ${soundNotifications ? 'translate-x-4' : 'translate-x-0'}`} />
            </div>
          </div>

          {/* Compact Chat Mode */}
          <div
            onClick={() => setCompactChat(!compactChat)}
            className="p-3 rounded-lg bento-card flex items-center justify-between cursor-pointer hover:border-white/20 transition-colors"
          >
            <div className="flex items-center gap-2.5">
              <LayoutGrid size={16} className="text-[var(--theme-text-muted)]" />
              <div>
                <div className="text-xs font-medium text-[var(--theme-text)]">Компактный вид чата</div>
                <div className="text-[11px] text-[var(--theme-text-muted)]">Уменьшенные отступы в сообщениях</div>
              </div>
            </div>
            <div
              className={`w-9 h-5 rounded-md p-0.5 flex items-center transition-colors ${
                compactChat ? 'bg-white/30' : 'bg-white/10'
              }`}
            >
              <div className={`w-4 h-4 rounded-sm bg-white transition-transform ${compactChat ? 'translate-x-4' : 'translate-x-0'}`} />
            </div>
          </div>
        </div>
      </div>

      {/* 3. Jarvis Voice Intercom & Proactive Companion */}
      <div className="p-4 rounded-xl bento-card space-y-4">
        <div className="flex items-center justify-between border-b border-[var(--theme-border)] pb-2">
          <div className="flex items-center gap-2 text-xs font-semibold text-[var(--theme-text)]">
            <Volume2 size={15} className="text-[var(--theme-accent)]" />
            <span>Голосовой интерком Jarvis и автономный напарник</span>
          </div>
          <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-sky-500/10 text-sky-400 border border-sky-500/20">
            :: Push-Driven Engine
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {/* Voice Intercom Toggle */}
          <div
            onClick={() => setTtsVoiceEnabled && setTtsVoiceEnabled(!ttsVoiceEnabled)}
            className="p-3 rounded-lg bento-card flex items-center justify-between cursor-pointer hover:border-white/20 transition-colors"
          >
            <div>
              <div className="text-xs font-medium text-[var(--theme-text)]">Голосовой интерком (Edge-TTS)</div>
              <div className="text-[11px] text-[var(--theme-text-muted)]">Короткие реплики вслух через динамики</div>
            </div>
            <div
              className={`w-9 h-5 rounded-md p-0.5 flex items-center transition-colors ${
                ttsVoiceEnabled ? 'bg-sky-500/80' : 'bg-white/10'
              }`}
            >
              <div className={`w-4 h-4 rounded-sm bg-white transition-transform ${ttsVoiceEnabled ? 'translate-x-4' : 'translate-x-0'}`} />
            </div>
          </div>

          {/* Proactive Companion Sparks Toggle */}
          <div
            onClick={() => setProactiveCompanionEnabled && setProactiveCompanionEnabled(!proactiveCompanionEnabled)}
            className="p-3 rounded-lg bento-card flex items-center justify-between cursor-pointer hover:border-white/20 transition-colors"
          >
            <div>
              <div className="text-xs font-medium text-[var(--theme-text)]">Автономный генератор искр (Sparks)</div>
              <div className="text-[11px] text-[var(--theme-text-muted)]">Zero-pressure предложения без шейминга</div>
            </div>
            <div
              className={`w-9 h-5 rounded-md p-0.5 flex items-center transition-colors ${
                proactiveCompanionEnabled ? 'bg-sky-500/80' : 'bg-white/10'
              }`}
            >
              <div className={`w-4 h-4 rounded-sm bg-white transition-transform ${proactiveCompanionEnabled ? 'translate-x-4' : 'translate-x-0'}`} />
            </div>
          </div>
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
                  className="w-full text-xs px-2.5 py-1.5 rounded-lg bg-black/40 border border-[var(--theme-border)] text-[var(--theme-text)] focus:outline-none focus:border-sky-500"
                >
                  <option value="ru-RU-SvetlanaNeural">Светлана (Женский, четкий)</option>
                  <option value="ru-RU-DmitryNeural">Дмитрий (Мужской, глубокий)</option>
                </select>
              </div>

              <div>
                <label className="text-[11px] font-medium text-[var(--theme-text-muted)] block mb-1.5 font-mono">
                  Скорость речи
                </label>
                <select
                  value={ttsRate}
                  onChange={(e) => setTtsRate && setTtsRate(e.target.value)}
                  className="w-full text-xs px-2.5 py-1.5 rounded-lg bg-black/40 border border-[var(--theme-border)] text-[var(--theme-text)] focus:outline-none focus:border-sky-500"
                >
                  <option value="+0%">Стандартная (+0%)</option>
                  <option value="+15%">Быстрая (+15%)</option>
                  <option value="+20%">Оптимальная (+20%)</option>
                  <option value="+30%">Ультра (+30%)</option>
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
                  className="w-full flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/15 border border-[var(--theme-border)] text-xs text-[var(--theme-text)] transition-colors active:scale-95 cursor-pointer"
                >
                  <Volume2 size={13} className="text-sky-400" />
                  <span>Тест голоса</span>
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-[var(--theme-border)]">
              <label className="flex items-center gap-2 cursor-pointer text-xs text-[var(--theme-text-muted)] hover:text-[var(--theme-text)]">
                <input
                  type="checkbox"
                  checked={ttsPlayOnSpeaker}
                  onChange={(e) => setTtsPlayOnSpeaker && setTtsPlayOnSpeaker(e.target.checked)}
                  className="rounded border-[var(--theme-border)] text-sky-500 focus:ring-0"
                />
                <span>Воспроизводить через системные динамики (MCI)</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer text-xs text-[var(--theme-text-muted)] hover:text-[var(--theme-text)]">
                <input
                  type="checkbox"
                  checked={ttsPlayInBrowser}
                  onChange={(e) => setTtsPlayInBrowser && setTtsPlayInBrowser(e.target.checked)}
                  className="rounded border-[var(--theme-border)] text-sky-500 focus:ring-0"
                />
                <span>Воспроизводить в активной вкладке браузера</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer text-xs text-[var(--theme-text-muted)] hover:text-[var(--theme-text)] sm:col-span-2">
                <input
                  type="checkbox"
                  checked={wakeWordEnabled}
                  onChange={(e) => setWakeWordEnabled && setWakeWordEnabled(e.target.checked)}
                  className="rounded border-[var(--theme-border)] text-sky-500 focus:ring-0"
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
