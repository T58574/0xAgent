import React, { useState, useEffect } from 'react';
import { Folder, Search, X, RefreshCw, Cpu, Layers, HardDrive, Check, Eye } from 'lucide-react';
import { GgufMetadata } from '../types';
import * as api from '../services/api';

interface ModelPickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectModel: (filePath: string, metadata?: GgufMetadata) => void;
  initialDir?: string;
}

export const ModelPickerModal: React.FC<ModelPickerModalProps> = ({
  isOpen,
  onClose,
  onSelectModel,
  initialDir,
}) => {
  const [scanDir, setScanDir] = useState<string>(initialDir || '');
  const [modelsList, setModelsList] = useState<GgufMetadata[]>([]);
  const [isScanning, setIsScanning] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');

  useEffect(() => {
    if (isOpen) {
      handleScan(initialDir);
    }
  }, [isOpen, initialDir]);

  const handleScan = async (dirToScan?: string) => {
    setIsScanning(true);
    try {
      const res = await api.scan_models_dir(dirToScan || scanDir);
      setScanDir(res.dirPath);
      setModelsList(res.models);
    } catch (err) {
      console.error('Failed to scan models directory:', err);
    } finally {
      setIsScanning(false);
    }
  };

  const handleSelectFolderNative = async () => {
    try {
      const folder = await api.select_workspace();
      if (folder) {
        setScanDir(folder);
        await handleScan(folder);
      }
    } catch (err) {
      console.error('Folder selection error:', err);
    }
  };

  if (!isOpen) return null;

  const filteredModels = modelsList.filter((m) => {
    const q = searchQuery.toLowerCase();
    return (
      m.fileName.toLowerCase().includes(q) ||
      m.architecture.toLowerCase().includes(q) ||
      m.quantization.toLowerCase().includes(q) ||
      m.modelName.toLowerCase().includes(q)
    );
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 font-sans select-none animate-fadeIn">
      <div className="w-full max-w-3xl glass-panel rounded-lg border border-white/15 shadow-2xl flex flex-col max-h-[85vh] overflow-hidden text-slate-100">
        
        {/* Header */}
        <div className="px-4 py-3 border-b border-white/10 flex items-center justify-between bg-slate-900/60">
          <div className="flex items-center gap-2">
            <Cpu size={16} className="text-emerald-400" />
            <h3 className="text-sm font-semibold text-slate-100">Сканер папки GGUF моделей</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded text-slate-400 hover:text-white hover:bg-white/10 cursor-pointer"
          >
            <X size={15} />
          </button>
        </div>

        {/* Directory Picker & Search Bar */}
        <div className="p-4 space-y-3 border-b border-white/10 bg-slate-950/40">
          <div className="flex gap-2">
            <div className="flex-1 relative">
              <input
                type="text"
                value={scanDir}
                onChange={(e) => setScanDir(e.target.value)}
                placeholder="Директория с моделями..."
                className="w-full pl-3 pr-8 py-2 rounded flat-input text-xs font-mono text-slate-100 focus:outline-none"
              />
            </div>
            <button
              type="button"
              onClick={handleSelectFolderNative}
              className="flat-btn px-3 py-2 rounded text-xs font-medium text-slate-200 hover:text-white flex items-center gap-1.5 shrink-0"
              title="Выбрать папку"
            >
              <Folder size={13} />
              <span>Обзор</span>
            </button>
            <button
              type="button"
              onClick={() => handleScan()}
              disabled={isScanning}
              className="flat-btn px-3.5 py-2 rounded text-xs font-medium text-emerald-400 border-emerald-500/40 hover:bg-emerald-500/10 flex items-center gap-1.5 shrink-0 disabled:opacity-50"
            >
              <RefreshCw size={13} className={isScanning ? 'animate-spin' : ''} />
              <span>Сканировать</span>
            </button>
          </div>

          <div className="relative">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Фильтр по названию, архитектуре или кванту..."
              className="w-full pl-9 pr-3 py-1.5 rounded flat-input text-xs text-slate-100 focus:outline-none"
            />
          </div>
        </div>

        {/* Scanned Models List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2.5 scrollbar-none">
          {isScanning ? (
            <div className="flex flex-col items-center justify-center py-12 text-slate-400 space-y-2">
              <RefreshCw size={24} className="animate-spin text-emerald-400" />
              <span className="text-xs">Чтение бинарных GGUF заголовков...</span>
            </div>
          ) : filteredModels.length === 0 ? (
            <div className="text-center py-12 text-slate-500 text-xs italic">
              Модели .gguf в этой директории не найдены. Укажите другую папку.
            </div>
          ) : (
            filteredModels.map((model) => (
              <div
                key={model.filePath}
                className={`p-3 rounded border transition-all flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 ${
                  model.isMmproj
                    ? 'border-amber-500/30 bg-amber-500/5'
                    : 'border-white/10 bg-slate-900/50 hover:border-emerald-500/40'
                }`}
              >
                <div className="space-y-1.5 min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-mono text-xs font-semibold text-slate-100 truncate">{model.fileName}</span>
                    
                    {/* Arch badge */}
                    <span className="text-[10px] px-1.5 py-0.2 rounded bg-sky-500/20 text-sky-300 border border-sky-500/30 uppercase font-mono font-bold">
                      {model.architecture}
                    </span>

                    {/* Quant badge */}
                    <span className="text-[10px] px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-mono font-semibold">
                      {model.quantization}
                    </span>

                    {/* Size badge */}
                    <span className="text-[10px] px-1.5 py-0.2 rounded bg-slate-800 text-slate-300 border border-white/10 flex items-center gap-1 font-mono">
                      <HardDrive size={10} />
                      <span>{model.fileSizeFormatted}</span>
                    </span>

                    {/* Vision Projector warning badge */}
                    {model.isMmproj && (
                      <span className="text-[10px] px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 border border-amber-500/40 font-semibold flex items-center gap-1">
                        <Eye size={10} />
                        <span>Vision mmproj</span>
                      </span>
                    )}
                  </div>

                  {/* Metadata Row */}
                  <div className="flex items-center gap-3 text-[11px] text-slate-400 font-mono flex-wrap">
                    {model.blockCount > 0 && (
                      <span className="flex items-center gap-1">
                        <Layers size={11} className="text-emerald-400" />
                        <span>{model.blockCount} слоев</span>
                      </span>
                    )}
                    {model.contextLength > 0 && (
                      <span>Макс. контекст: {model.contextLength.toLocaleString()} токенов</span>
                    )}
                    {model.expertCount > 0 && (
                      <span className="text-purple-400">MoE: {model.expertCount} экспертов</span>
                    )}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    onSelectModel(model.filePath, model);
                    onClose();
                  }}
                  className={`flat-btn px-3 py-1.5 rounded text-xs font-medium shrink-0 cursor-pointer flex items-center gap-1.5 ${
                    model.isMmproj
                      ? 'text-amber-300 border-amber-500/40 hover:bg-amber-500/10'
                      : 'text-emerald-400 border-emerald-500/40 hover:bg-emerald-500/10'
                  }`}
                >
                  <Check size={13} />
                  <span>Выбрать</span>
                </button>
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="px-4 py-2.5 bg-slate-900/60 border-t border-white/10 flex items-center justify-between text-xs text-slate-400">
          <span>Найдено файлов: {filteredModels.length}</span>
          <button
            type="button"
            onClick={onClose}
            className="flat-btn px-3 py-1 rounded text-xs font-medium text-slate-300 hover:text-white"
          >
            Закрыть
          </button>
        </div>

      </div>
    </div>
  );
};
