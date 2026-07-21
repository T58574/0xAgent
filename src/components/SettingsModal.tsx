import React, { useState, useEffect } from 'react';
import { X, Save, Undo } from 'lucide-react';
import { AppConfig } from '../types';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  config: AppConfig | null;
  onSaveConfig: (updated: AppConfig) => Promise<void>;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  config,
  onSaveConfig,
}) => {
  const [activeTab, setActiveTab] = useState<'general' | 'colors'>('general');

  // General settings state
  const [apiUrl, setApiUrl] = useState('');
  const [modelName, setModelName] = useState('');
  const [systemPrompt, setSystemPrompt] = useState('');
  const [groqApiKey, setGroqApiKey] = useState('');

  // Colors settings state
  const [bgColor, setBgColor] = useState('#ffffff');
  const [textColor, setTextColor] = useState('#000000');
  const [borderColor, setBorderColor] = useState('#000000');
  const [activeColor, setActiveColor] = useState('#f5f5f5');
  const [sendBtnColor, setSendBtnColor] = useState('#86efac');

  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (config) {
      setApiUrl(config.api_url);
      setModelName(config.model_name);
      setSystemPrompt(config.system_prompt);
      setGroqApiKey(config.groq_api_key || '');
      
      const colors = config.theme_colors || {
        bg_color: '#ffffff',
        text_color: '#000000',
        border_color: '#000000',
        active_color: '#f5f5f5',
        send_btn_color: '#86efac',
      };
      setBgColor(colors.bg_color);
      setTextColor(colors.text_color);
      setBorderColor(colors.border_color);
      setActiveColor(colors.active_color);
      setSendBtnColor(colors.send_btn_color);
    }
  }, [config, isOpen]);

  if (!isOpen) return null;

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!config) return;
    setIsSaving(true);
    try {
      await onSaveConfig({
        ...config,
        api_url: apiUrl,
        model_name: modelName,
        system_prompt: systemPrompt,
        groq_api_key: groqApiKey.trim() || null,
        theme_colors: {
          bg_color: bgColor,
          text_color: textColor,
          border_color: borderColor,
          active_color: activeColor,
          send_btn_color: sendBtnColor,
        },
      });
      onClose();
    } catch (err) {
      console.error(err);
    } finally {
      setIsSaving(false);
    }
  };

  const handleResetToDefault = () => {
    if (activeTab === 'general') {
      setApiUrl('http://127.0.0.1:11434/v1');
      setModelName('qwen2.5-coder:7b');
      setGroqApiKey('');
      setSystemPrompt(
        "You are a helpful, professional, and powerful AI coding assistant. You are running locally on the user's computer and have access to their files and terminal. You have access to tools. To call a tool, output its XML tag format exactly. Rules: - You must output tool tags exactly..."
      );
    } else {
      setBgColor('#ffffff');
      setTextColor('#000000');
      setBorderColor('#000000');
      setActiveColor('#f5f5f5');
      setSendBtnColor('#86efac');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
      <div className="relative w-full max-w-2xl border border-black rounded-2xl bg-white shadow-2xl overflow-hidden text-black flex flex-col max-h-[90vh]">
        
        {/* Modal Header */}
        <div className="flex items-center justify-between p-4 border-b border-black bg-neutral-50 shrink-0">
          <div className="flex items-center gap-4">
            <h2 className="text-xs font-bold uppercase tracking-wider">Developer settings</h2>
            {/* Tabs selector */}
            <div className="flex border border-black rounded-full p-0.5 bg-white select-none">
              <button
                type="button"
                onClick={() => setActiveTab('general')}
                className={`px-3 py-0.5 text-[10px] font-bold uppercase rounded-full cursor-pointer transition-colors focus:outline-none ${
                  activeTab === 'general' ? 'bg-black text-white' : 'text-neutral-500 hover:text-black'
                }`}
              >
                General
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('colors')}
                className={`px-3 py-0.5 text-[10px] font-bold uppercase rounded-full cursor-pointer transition-colors focus:outline-none ${
                  activeTab === 'colors' ? 'bg-black text-white' : 'text-neutral-500 hover:text-black'
                }`}
              >
                Colors
              </button>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-full border border-black hover:bg-neutral-200 text-black transition-colors cursor-pointer focus:outline-none"
          >
            <X size={14} />
          </button>
        </div>

        {/* Modal Body */}
        <form onSubmit={handleSave} className="p-5 flex-1 overflow-y-auto space-y-4">
          {activeTab === 'general' ? (
            <>
              {/* API URL */}
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-neutral-500 uppercase tracking-wider">
                  API Connection URL
                </label>
                <input
                  type="text"
                  value={apiUrl}
                  onChange={(e) => setApiUrl(e.target.value)}
                  placeholder="e.g. http://127.0.0.1:11434/v1"
                  required
                  className="w-full px-4 py-2 rounded-full bg-white border border-black text-xs font-mono text-black focus:outline-none focus:bg-neutral-50 transition-colors"
                />
              </div>

              {/* Model Name */}
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-neutral-500 uppercase tracking-wider">
                  Model Name identifier
                </label>
                <input
                  type="text"
                  value={modelName}
                  onChange={(e) => setModelName(e.target.value)}
                  placeholder="e.g. qwen2.5-coder:7b"
                  required
                  className="w-full px-4 py-2 rounded-full bg-white border border-black text-xs font-mono text-black focus:outline-none focus:bg-neutral-50 transition-colors"
                />
              </div>

              {/* Groq API Key */}
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-neutral-500 uppercase tracking-wider">
                  Groq API Key (For Voice Transcription)
                </label>
                <input
                  type="password"
                  value={groqApiKey}
                  onChange={(e) => setGroqApiKey(e.target.value)}
                  placeholder="gsk_..."
                  className="w-full px-4 py-2 rounded-full bg-white border border-black text-xs font-mono text-black focus:outline-none focus:bg-neutral-50 transition-colors"
                />
              </div>

              {/* System Instructions */}
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-neutral-500 uppercase tracking-wider">
                  Agent System Instructions
                </label>
                <textarea
                  rows={6}
                  value={systemPrompt}
                  onChange={(e) => setSystemPrompt(e.target.value)}
                  required
                  className="w-full px-4 py-2.5 rounded-2xl bg-white border border-black text-xs font-mono text-black focus:outline-none focus:bg-neutral-50 transition-colors resize-none"
                />
              </div>
            </>
          ) : (
            <div className="space-y-4">
              <p className="text-[10px] text-neutral-500 uppercase tracking-wider font-bold mb-2">
                Interface Color Settings (HEX)
              </p>

              {/* Background Color */}
              <div className="flex items-center justify-between gap-4 border-b border-neutral-100 pb-2">
                <div>
                  <div className="text-xs font-bold text-black">Window Background</div>
                  <div className="text-[10px] text-neutral-500">Main screen canvas color</div>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={bgColor}
                    onChange={(e) => setBgColor(e.target.value)}
                    placeholder="#ffffff"
                    className="w-24 px-3 py-1 rounded-full border border-black text-xs font-mono text-center focus:outline-none"
                  />
                  <input
                    type="color"
                    value={bgColor}
                    onChange={(e) => setBgColor(e.target.value)}
                    className="w-8 h-8 rounded border border-black cursor-pointer overflow-hidden p-0"
                  />
                </div>
              </div>

              {/* Text Color */}
              <div className="flex items-center justify-between gap-4 border-b border-neutral-100 pb-2">
                <div>
                  <div className="text-xs font-bold text-black">Main Text</div>
                  <div className="text-[10px] text-neutral-500">Default typography text color</div>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={textColor}
                    onChange={(e) => setTextColor(e.target.value)}
                    placeholder="#000000"
                    className="w-24 px-3 py-1 rounded-full border border-black text-xs font-mono text-center focus:outline-none"
                  />
                  <input
                    type="color"
                    value={textColor}
                    onChange={(e) => setTextColor(e.target.value)}
                    className="w-8 h-8 rounded border border-black cursor-pointer overflow-hidden p-0"
                  />
                </div>
              </div>

              {/* Border Color */}
              <div className="flex items-center justify-between gap-4 border-b border-neutral-100 pb-2">
                <div>
                  <div className="text-xs font-bold text-black">Border Outlines</div>
                  <div className="text-[10px] text-neutral-500">Outer containers and buttons borders</div>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={borderColor}
                    onChange={(e) => setBorderColor(e.target.value)}
                    placeholder="#000000"
                    className="w-24 px-3 py-1 rounded-full border border-black text-xs font-mono text-center focus:outline-none"
                  />
                  <input
                    type="color"
                    value={borderColor}
                    onChange={(e) => setBorderColor(e.target.value)}
                    className="w-8 h-8 rounded border border-black cursor-pointer overflow-hidden p-0"
                  />
                </div>
              </div>

              {/* Active Color */}
              <div className="flex items-center justify-between gap-4 border-b border-neutral-100 pb-2">
                <div>
                  <div className="text-xs font-bold text-black">Active Item Background</div>
                  <div className="text-[10px] text-neutral-500">Active tabs and selected elements</div>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={activeColor}
                    onChange={(e) => setActiveColor(e.target.value)}
                    placeholder="#f5f5f5"
                    className="w-24 px-3 py-1 rounded-full border border-black text-xs font-mono text-center focus:outline-none"
                  />
                  <input
                    type="color"
                    value={activeColor}
                    onChange={(e) => setActiveColor(e.target.value)}
                    className="w-8 h-8 rounded border border-black cursor-pointer overflow-hidden p-0"
                  />
                </div>
              </div>

              {/* Send Button Color */}
              <div className="flex items-center justify-between gap-4 border-b border-neutral-100 pb-2">
                <div>
                  <div className="text-xs font-bold text-black">Send Button Background</div>
                  <div className="text-[10px] text-neutral-500">Green submit button hex color</div>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={sendBtnColor}
                    onChange={(e) => setSendBtnColor(e.target.value)}
                    placeholder="#86efac"
                    className="w-24 px-3 py-1 rounded-full border border-black text-xs font-mono text-center focus:outline-none"
                  />
                  <input
                    type="color"
                    value={sendBtnColor}
                    onChange={(e) => setSendBtnColor(e.target.value)}
                    className="w-8 h-8 rounded border border-black cursor-pointer overflow-hidden p-0"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Modal Footer */}
          <div className="flex items-center justify-between pt-4 border-t border-neutral-200 mt-5 shrink-0">
            <button
              type="button"
              onClick={handleResetToDefault}
              className="flex items-center gap-1.5 px-4 py-1.5 rounded-full border border-black bg-white hover:bg-neutral-100 text-black text-xs font-bold cursor-pointer transition-colors focus:outline-none"
            >
              <Undo size={12} />
              <span>Defaults</span>
            </button>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-1.5 rounded-full border border-black bg-white hover:bg-neutral-100 text-black text-xs font-bold cursor-pointer transition-colors focus:outline-none"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSaving}
                className="flex items-center gap-1.5 px-5 py-1.5 rounded-full border border-black bg-[#86EFAC] hover:bg-green-400 text-black text-xs font-bold cursor-pointer transition-colors focus:outline-none"
              >
                <Save size={12} />
                <span>{isSaving ? 'Saving...' : 'Save'}</span>
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
