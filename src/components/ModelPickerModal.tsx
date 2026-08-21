import React, { useState, useEffect } from 'react';
import { Folder, Search, X, RefreshCw, Cpu, Layers, HardDrive, Check, Eye } from 'lucide-react';
import { GgufMetadata } from '../types';
import * as api from '../services/api';
import { useI18n } from '../i18n';

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
  const { t, formatString } = useI18n();
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-md p-4 font-sans select-none animate-fadeIn">
      <div className="w-full max-w-3xl bento-card rounded-xl border border-[var(--theme-border)] shadow-2xl flex flex-col max-h-[85vh] overflow-hidden text-[var(--theme-text)] bg-[var(--theme-panel)]">
        
        {/* Header */}
        <div className="px-5 py-3.5 border-b border-[var(--theme-border)] flex items-center justify-between bg-black/40">
          <div className="flex items-center gap-2">
            <Cpu size={16} className="text-[var(--theme-text-muted)]" />
            <h3 className="text-xs font-semibold text-[var(--theme-text)]">{t.modals.modelPicker.title}</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-md text-[var(--theme-text-muted)] hover:text-[var(--theme-text)] hover:bg-white/10 cursor-pointer"
          >
            <X size={15} />
          </button>
        </div>

        {/* Directory Picker & Search Bar */}
        <div className="p-4 space-y-2.5 border-b border-[var(--theme-border)] bg-black/20">
          <div className="flex gap-2">
            <div className="flex-1 relative">
              <input
                type="text"
                value={scanDir}
                onChange={(e) => setScanDir(e.target.value)}
                placeholder={t.modals.modelPicker.scanDirPlaceholder}
                className="w-full px-3 py-2 rounded-lg bento-card text-xs font-mono text-[var(--theme-text)] focus:outline-none bg-black/40"
              />
            </div>
            <button
              type="button"
              onClick={handleSelectFolderNative}
              className="px-3 py-2 rounded-lg bg-white/10 hover:bg-white/15 border border-[var(--theme-border)] text-xs font-medium text-[var(--theme-text)] flex items-center gap-1.5 shrink-0 cursor-pointer transition-colors"
              title={t.modals.modelPicker.browse}
            >
              <Folder size={13} className="text-[var(--theme-text-muted)]" />
              <span>{t.modals.modelPicker.browse}</span>
            </button>
            <button
              type="button"
              onClick={() => handleScan()}
              disabled={isScanning}
              className="px-3.5 py-2 rounded-lg bg-white/10 hover:bg-white/15 border border-[var(--theme-border)] text-xs font-medium text-[var(--theme-text)] flex items-center gap-1.5 shrink-0 disabled:opacity-50 cursor-pointer transition-colors"
            >
              <RefreshCw size={13} className={`text-[var(--theme-text-muted)] ${isScanning ? 'animate-spin' : ''}`} />
              <span>{t.modals.modelPicker.scanBtn}</span>
            </button>
          </div>

          <div className="relative">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--theme-text-muted)]" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t.modals.modelPicker.searchPlaceholder}
              className="w-full pl-9 pr-3 py-1.5 rounded-lg bento-card text-xs text-[var(--theme-text)] focus:outline-none bg-black/40"
            />
          </div>
        </div>

        {/* Scanned Models List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2 scrollbar-thin">
          {isScanning ? (
            <div className="flex flex-col items-center justify-center py-12 text-[var(--theme-text-muted)] space-y-2">
              <RefreshCw size={20} className="animate-spin text-[var(--theme-text-muted)]" />
              <span className="text-xs">{t.modals.modelPicker.readingHeaders}</span>
            </div>
          ) : filteredModels.length === 0 ? (
            <div className="text-center py-12 text-[var(--theme-text-muted)] text-xs italic">
              {t.modals.modelPicker.noModelsFound}
            </div>
          ) : (
            filteredModels.map((model) => (
              <div
                key={model.filePath}
                className="p-3 rounded-lg bento-card border border-[var(--theme-border)] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3"
              >
                <div className="space-y-1 min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-mono text-xs font-semibold text-[var(--theme-text)] truncate">{model.fileName}</span>
                    
                    {/* Arch badge */}
                    <span className="text-[10px] px-1.5 py-0.2 rounded-md bg-white/10 text-[var(--theme-text-muted)] border border-[var(--theme-border)] uppercase font-mono">
                      {model.architecture}
                    </span>

                    {/* Quant badge */}
                    <span className="text-[10px] px-1.5 py-0.2 rounded-md bg-white/10 text-[var(--theme-text-muted)] border border-[var(--theme-border)] font-mono">
                      {model.quantization}
                    </span>

                    {/* Size badge */}
                    <span className="text-[10px] px-1.5 py-0.2 rounded-md bg-white/5 text-[var(--theme-text-muted)] border border-[var(--theme-border)] flex items-center gap-1 font-mono">
                      <HardDrive size={10} />
                      <span>{model.fileSizeFormatted}</span>
                    </span>

                    {/* Vision Projector badge */}
                    {model.isMmproj && (
                      <span className="text-[10px] px-1.5 py-0.2 rounded-md bg-white/10 text-[var(--theme-text-muted)] border border-[var(--theme-border)] flex items-center gap-1">
                        <Eye size={10} />
                        <span>Vision mmproj</span>
                      </span>
                    )}
                  </div>

                  {/* Metadata Row */}
                  <div className="flex items-center gap-3 text-[11px] text-[var(--theme-text-muted)] font-mono flex-wrap">
                    {model.blockCount > 0 && (
                      <span className="flex items-center gap-1">
                        <Layers size={11} />
                        <span>{formatString(t.modals.modelPicker.layersCount, { count: model.blockCount })}</span>
                      </span>
                    )}
                    {model.contextLength > 0 && (
                      <span>{formatString(t.modals.modelPicker.maxContext, { ctx: model.contextLength.toLocaleString() })}</span>
                    )}
                    {model.expertCount > 0 && (
                      <span>{formatString(t.modals.modelPicker.expertsCount, { count: model.expertCount })}</span>
                    )}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    onSelectModel(model.filePath, model);
                    onClose();
                  }}
                  className="px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 border border-[var(--theme-border)] text-xs font-medium text-[var(--theme-text)] shrink-0 cursor-pointer flex items-center gap-1.5 transition-colors"
                >
                  <Check size={13} />
                  <span>{t.modals.modelPicker.selectBtn}</span>
                </button>
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="px-4 py-2.5 bg-black/40 border-t border-[var(--theme-border)] flex items-center justify-between text-xs text-[var(--theme-text-muted)]">
          <span>{formatString(t.modals.modelPicker.foundFiles, { count: filteredModels.length })}</span>
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1 rounded-lg bento-card text-xs font-medium text-[var(--theme-text-muted)] hover:text-[var(--theme-text)] cursor-pointer"
          >
            {t.modals.modelPicker.close}
          </button>
        </div>

      </div>
    </div>
  );
};
