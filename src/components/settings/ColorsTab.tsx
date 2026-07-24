import React from 'react';

interface ColorsTabProps {
  bgColor: string;
  setBgColor: (val: string) => void;
  textColor: string;
  setTextColor: (val: string) => void;
  borderColor: string;
  setBorderColor: (val: string) => void;
  activeColor: string;
  setActiveColor: (val: string) => void;
  sendBtnColor: string;
  setSendBtnColor: (val: string) => void;
}

export const ColorsTab: React.FC<ColorsTabProps> = ({
  bgColor,
  setBgColor,
  textColor,
  setTextColor,
  borderColor,
  setBorderColor,
  activeColor,
  setActiveColor,
  sendBtnColor,
  setSendBtnColor,
}) => {
  return (
    <div className="max-w-2xl space-y-4 font-sans text-slate-100">
      <p className="text-[10px] font-hud uppercase tracking-wider font-bold text-slate-400 mb-2">
        Настройка цветов интерфейса вручную (HEX)
      </p>

      {/* Canvas Background Color */}
      <div className="flex items-center justify-between gap-4 border-b border-white/10 pb-3">
        <div>
          <div className="text-xs font-bold text-slate-200">Фон окна (bg_color)</div>
          <div className="text-[10px] text-slate-400">Основной цвет холста приложения</div>
        </div>
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={bgColor}
            onChange={(e) => setBgColor(e.target.value)}
            placeholder="#090d16"
            className="w-28 px-3 py-1.5 rounded-xl skeuo-input text-xs font-mono text-center focus:outline-none"
          />
          <input
            type="color"
            value={bgColor}
            onChange={(e) => setBgColor(e.target.value)}
            className="w-8 h-8 rounded-lg border border-white/20 cursor-pointer overflow-hidden p-0 bg-transparent"
          />
        </div>
      </div>

      {/* Font Text Color */}
      <div className="flex items-center justify-between gap-4 border-b border-white/10 pb-3">
        <div>
          <div className="text-xs font-bold text-slate-200">Цвет шрифта (text_color)</div>
          <div className="text-[10px] text-slate-400">Цвет основного текста</div>
        </div>
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={textColor}
            onChange={(e) => setTextColor(e.target.value)}
            placeholder="#f8fafc"
            className="w-28 px-3 py-1.5 rounded-xl skeuo-input text-xs font-mono text-center focus:outline-none"
          />
          <input
            type="color"
            value={textColor}
            onChange={(e) => setTextColor(e.target.value)}
            className="w-8 h-8 rounded-lg border border-white/20 cursor-pointer overflow-hidden p-0 bg-transparent"
          />
        </div>
      </div>

      {/* Border Color */}
      <div className="flex items-center justify-between gap-4 border-b border-white/10 pb-3">
        <div>
          <div className="text-xs font-bold text-slate-200">Рамки и границы (border_color)</div>
          <div className="text-[10px] text-slate-400">Цвет контуров стеклянных блоков</div>
        </div>
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={borderColor}
            onChange={(e) => setBorderColor(e.target.value)}
            placeholder="rgba(255,255,255,0.1)"
            className="w-28 px-3 py-1.5 rounded-xl skeuo-input text-xs font-mono text-center focus:outline-none"
          />
          <input
            type="color"
            value={borderColor.startsWith('#') ? borderColor : '#ffffff'}
            onChange={(e) => setBorderColor(e.target.value)}
            className="w-8 h-8 rounded-lg border border-white/20 cursor-pointer overflow-hidden p-0 bg-transparent"
          />
        </div>
      </div>

      {/* Active Accent Color */}
      <div className="flex items-center justify-between gap-4 border-b border-white/10 pb-3">
        <div>
          <div className="text-xs font-bold text-slate-200">Активный элемент (active_color)</div>
          <div className="text-[10px] text-slate-400">Фон выбранных вкладок и элементов</div>
        </div>
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={activeColor}
            onChange={(e) => setActiveColor(e.target.value)}
            placeholder="rgba(30,41,59,0.7)"
            className="w-28 px-3 py-1.5 rounded-xl skeuo-input text-xs font-mono text-center focus:outline-none"
          />
          <input
            type="color"
            value={activeColor.startsWith('#') ? activeColor : '#1e293b'}
            onChange={(e) => setActiveColor(e.target.value)}
            className="w-8 h-8 rounded-lg border border-white/20 cursor-pointer overflow-hidden p-0 bg-transparent"
          />
        </div>
      </div>

      {/* Send Button Color */}
      <div className="flex items-center justify-between gap-4 border-b border-white/10 pb-3">
        <div>
          <div className="text-xs font-bold text-slate-200">Кнопка отправки чата (send_btn_color)</div>
          <div className="text-[10px] text-slate-400">Цвет акцентной кнопки "Отправить"</div>
        </div>
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={sendBtnColor}
            onChange={(e) => setSendBtnColor(e.target.value)}
            placeholder="#3b82f6"
            className="w-28 px-3 py-1.5 rounded-xl skeuo-input text-xs font-mono text-center focus:outline-none"
          />
          <input
            type="color"
            value={sendBtnColor}
            onChange={(e) => setSendBtnColor(e.target.value)}
            className="w-8 h-8 rounded-lg border border-white/20 cursor-pointer overflow-hidden p-0 bg-transparent"
          />
        </div>
      </div>
    </div>
  );
};
