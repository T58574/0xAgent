import React, { useState, useEffect, useRef } from 'react';
import {
  Save,
  Copy,
  Check,
  Search,
  WrapText,
  ZoomIn,
  ZoomOut,
  Edit3,
  Eye,
  FileCode,
  Folder,
  ChevronRight,
  X,
} from 'lucide-react';
import * as api from '../services/api';
import { useToast } from '../context/ToastContext';

export interface EditorTabItem {
  path: string;
  name: string;
  content: string;
  isDirty?: boolean;
}

interface CodeEditorProps {
  selectedFile: { path: string; name: string; content: string } | null;
  openTabs: EditorTabItem[];
  onSelectTab: (path: string) => void;
  onCloseTab: (path: string, e: React.MouseEvent) => void;
  onFileSaved?: (path: string, newContent: string) => void;
}

export const CodeEditor: React.FC<CodeEditorProps> = ({
  selectedFile,
  openTabs,
  onSelectTab,
  onCloseTab,
  onFileSaved,
}) => {
  const { showToast } = useToast();
  const [editorContent, setEditorContent] = useState<string>('');
  const [isEditing, setIsEditing] = useState<boolean>(true);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [copied, setCopied] = useState<boolean>(false);
  const [wordWrap, setWordWrap] = useState<boolean>(false);
  const [fontSize, setFontSize] = useState<number>(12); // px
  
  // Search in file state
  const [showSearch, setShowSearch] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Sync content when selectedFile changes
  useEffect(() => {
    if (selectedFile) {
      setEditorContent(selectedFile.content || '');
    } else {
      setEditorContent('');
    }
  }, [selectedFile?.path, selectedFile?.content]);

  // Is file modified compared to original content
  const isDirty = selectedFile ? editorContent !== selectedFile.content : false;

  // Handle Save
  const handleSave = async () => {
    if (!selectedFile) return;
    setIsSaving(true);
    try {
      await api.write_file_raw(selectedFile.path, editorContent);
      showToast(`Файл "${selectedFile.name}" успешно сохранен`, 'success');
      if (onFileSaved) {
        onFileSaved(selectedFile.path, editorContent);
      }
    } catch (err: any) {
      console.error('Failed to save file:', err);
      showToast(`Ошибка сохранения: ${err.message || err}`, 'error');
    } finally {
      setIsSaving(false);
    }
  };

  // Keyboard shortcut Ctrl+S / Cmd+S & Ctrl+F
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        handleSave();
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'f') {
        e.preventDefault();
        setShowSearch((prev) => {
          if (!prev) {
            setTimeout(() => searchInputRef.current?.focus(), 50);
          }
          return !prev;
        });
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedFile, editorContent]);

  // Copy code to clipboard
  const handleCopyCode = () => {
    if (!editorContent) return;
    navigator.clipboard.writeText(editorContent).then(() => {
      setCopied(true);
      showToast('Код скопирован в буфер обмена', 'success');
      setTimeout(() => setCopied(false), 2000);
    });
  };

  // Detect file language
  const detectLanguage = (fileName: string): string => {
    const ext = fileName.split('.').pop()?.toLowerCase();
    switch (ext) {
      case 'ts':
      case 'tsx':
        return 'TypeScript';
      case 'js':
      case 'jsx':
        return 'JavaScript';
      case 'py':
        return 'Python';
      case 'rs':
        return 'Rust';
      case 'json':
        return 'JSON';
      case 'css':
        return 'CSS';
      case 'html':
        return 'HTML';
      case 'md':
        return 'Markdown';
      case 'sh':
      case 'ps1':
      case 'bat':
        return 'Shell';
      case 'cpp':
      case 'c':
      case 'h':
        return 'C/C++';
      case 'gguf':
        return 'GGUF Binary';
      default:
        return 'Text';
    }
  };

  // Safe Tokenizer for Syntax Highlighting (Zero XSS)
  const renderSafeHighlightedLine = (code: string): React.ReactNode => {
    if (!code) return '\u00A0';

    // Highlight search match if search is active
    if (searchQuery.trim()) {
      const escaped = searchQuery.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const parts = code.split(new RegExp(`(${escaped})`, 'gi'));
      if (parts.length > 1) {
        return parts.map((part, idx) =>
          part.toLowerCase() === searchQuery.toLowerCase() ? (
            <mark key={idx} className="bg-amber-400/30 text-amber-200 rounded px-0.5 font-bold">
              {part}
            </mark>
          ) : (
            <span key={idx}>{part}</span>
          )
        );
      }
    }

    // Tokenize comments, strings, keywords, function calls, numbers
    const tokenRegex = /(\/\/.*|\/\*[\s\S]*?\*\/|#.*)|(["'].*?["'])|\b(const|let|var|function|return|import|export|from|default|class|interface|type|extends|implements|pub|struct|fn|impl|use|enum|match|if|else|for|while|async|await|true|false|null|undefined|void|string|number|boolean|any|as|in|of|mut|extern|crate|mod|where|dyn|static|self|Self|def|elif|pass|lambda|try|except|finally|with|yield)\b|\b([a-zA-Z_]\w*)(?=\()|\b(\d+)\b/g;

    const parts: React.ReactNode[] = [];
    let lastIndex = 0;
    let match: RegExpExecArray | null;

    while ((match = tokenRegex.exec(code)) !== null) {
      if (match.index > lastIndex) {
        parts.push(code.substring(lastIndex, match.index));
      }

      const [fullMatch, comment, stringLit, keyword, fnCall, numberLit] = match;
      const key = `${match.index}-${fullMatch}`;

      if (comment) {
        parts.push(<span key={key} className="opacity-40 text-theme-muted italic">{comment}</span>);
      } else if (stringLit) {
        parts.push(<span key={key} className="text-emerald-400 font-medium">{stringLit}</span>);
      } else if (keyword) {
        parts.push(<span key={key} className="text-amber-400 font-medium">{keyword}</span>);
      } else if (fnCall) {
        parts.push(<span key={key} className="text-sky-400 font-medium">{fnCall}</span>);
      } else if (numberLit) {
        parts.push(<span key={key} className="text-emerald-300 font-medium">{numberLit}</span>);
      } else {
        parts.push(fullMatch);
      }

      lastIndex = tokenRegex.lastIndex;
    }

    if (lastIndex < code.length) {
      parts.push(code.substring(lastIndex));
    }

    return parts.length > 0 ? parts : '\u00A0';
  };

  const lines = editorContent.split('\n');
  const pathSegments = selectedFile ? selectedFile.path.split(/[\\/]/).filter(Boolean) : [];
  const searchMatchesCount = searchQuery.trim()
    ? (editorContent.toLowerCase().match(new RegExp(searchQuery.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')) || []).length
    : 0;

  return (
    <div className="h-full w-full bg-theme-bg text-theme-text flex flex-col font-mono text-xs overflow-hidden select-text">
      
      {/* 1. IDE EDITOR TABS BAR */}
      <div className="flex items-center justify-between bg-theme-panel border-b border-theme-border select-none shrink-0 font-sans">
        
        {/* Open File Tabs */}
        <div className="flex items-center overflow-x-auto scrollbar-none flex-1 min-w-0">
          {openTabs.map((tab) => {
            const isActive = selectedFile && selectedFile.path === tab.path;
            const tabIsDirty = isActive ? isDirty : tab.isDirty;

            return (
              <div
                key={tab.path}
                onClick={() => onSelectTab(tab.path)}
                className={`group flex items-center gap-2 px-3 py-2 border-r border-theme-border cursor-pointer transition-all shrink-0 ${
                  isActive
                    ? 'bg-theme-bg text-theme-text border-t-2 border-[var(--theme-accent)] font-medium shadow-inner'
                    : 'bg-black/20 text-theme-muted hover:bg-black/40 hover:text-theme-text'
                }`}
              >
                <FileCode size={13} className={isActive ? 'text-emerald-400' : 'text-slate-400'} />
                
                <span className="truncate max-w-[130px] font-mono text-xs">
                  {tab.name}
                </span>

                {/* Dirty Unsaved Dot */}
                {tabIsDirty && (
                  <span className="w-2 h-2 rounded-full bg-amber-400 shrink-0" title="Несохраненные изменения" />
                )}

                {/* Close Tab Button */}
                <button
                  type="button"
                  onClick={(e) => onCloseTab(tab.path, e)}
                  className="p-0.5 rounded hover:bg-rose-500/20 text-theme-muted hover:text-rose-400 transition-colors cursor-pointer"
                  title="Закрыть вкладку"
                >
                  <X size={12} />
                </button>
              </div>
            );
          })}
        </div>

        {/* Editor Quick Actions Toolbar */}
        {selectedFile && (
          <div className="flex items-center gap-1 px-2 shrink-0 border-l border-theme-border bg-black/30 py-1">
            
            {/* Save Button */}
            <button
              type="button"
              onClick={handleSave}
              disabled={isSaving || !isDirty}
              className={`px-2 py-1 rounded text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                isDirty
                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 hover:bg-emerald-500/30'
                  : 'text-slate-500 opacity-50 cursor-not-allowed'
              }`}
              title="Сохранить файл (Ctrl+S)"
            >
              <Save size={12} className={isSaving ? 'animate-spin' : ''} />
              <span className="hidden lg:inline">{isSaving ? 'Сохранение...' : 'Сохранить'}</span>
            </button>

            {/* Mode Toggle (Edit / View) */}
            <button
              type="button"
              onClick={() => setIsEditing(!isEditing)}
              className={`p-1.5 rounded transition-colors cursor-pointer ${
                isEditing ? 'bg-white/15 text-white' : 'text-slate-400 hover:text-white hover:bg-white/5'
              }`}
              title={isEditing ? 'Переключить в режим подсветки' : 'Переключить в интерактивный редактор'}
            >
              {isEditing ? <Edit3 size={13} className="text-cyan-400" /> : <Eye size={13} />}
            </button>

            {/* Search Trigger */}
            <button
              type="button"
              onClick={() => setShowSearch(!showSearch)}
              className={`p-1.5 rounded transition-colors cursor-pointer ${
                showSearch ? 'bg-white/15 text-white' : 'text-slate-400 hover:text-white hover:bg-white/5'
              }`}
              title="Поиск в файле (Ctrl+F)"
            >
              <Search size={13} />
            </button>

            {/* Word Wrap Toggle */}
            <button
              type="button"
              onClick={() => setWordWrap(!wordWrap)}
              className={`p-1.5 rounded transition-colors cursor-pointer ${
                wordWrap ? 'bg-white/15 text-white' : 'text-slate-400 hover:text-white hover:bg-white/5'
              }`}
              title="Перенос строк"
            >
              <WrapText size={13} />
            </button>

            {/* Font Zoom Controls */}
            <button
              type="button"
              onClick={() => setFontSize((prev) => Math.max(10, prev - 1))}
              className="p-1.5 rounded text-slate-400 hover:text-white hover:bg-white/5 cursor-pointer"
              title="Уменьшить шрифт"
            >
              <ZoomOut size={13} />
            </button>
            <button
              type="button"
              onClick={() => setFontSize((prev) => Math.min(20, prev + 1))}
              className="p-1.5 rounded text-slate-400 hover:text-white hover:bg-white/5 cursor-pointer"
              title="Увеличить шрифт"
            >
              <ZoomIn size={13} />
            </button>

            {/* Copy Code */}
            <button
              type="button"
              onClick={handleCopyCode}
              className="p-1.5 rounded text-slate-400 hover:text-white hover:bg-white/5 cursor-pointer"
              title="Скопировать весь код"
            >
              {copied ? <Check size={13} className="text-emerald-400" /> : <Copy size={13} />}
            </button>
          </div>
        )}
      </div>

      {/* 2. IDE BREADCRUMBS BAR */}
      {selectedFile && (
        <div className="flex items-center justify-between px-3 py-1 bg-black/40 border-b border-theme-border text-[11px] font-sans text-slate-400 select-none shrink-0">
          <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none min-w-0">
            <Folder size={12} className="text-emerald-400 shrink-0" />
            {pathSegments.map((seg, idx) => {
              const isLast = idx === pathSegments.length - 1;
              return (
                <React.Fragment key={idx}>
                  {idx > 0 && <ChevronRight size={10} className="text-slate-600 shrink-0" />}
                  <span className={`truncate ${isLast ? 'text-slate-200 font-semibold font-mono' : 'text-slate-400'}`}>
                    {seg}
                  </span>
                </React.Fragment>
              );
            })}
          </div>

          <div className="flex items-center gap-2.5 shrink-0 text-[10px] font-mono text-slate-500">
            <span className="px-1.5 py-0.5 rounded bg-white/[0.04] border border-white/10 text-slate-300">
              {detectLanguage(selectedFile.name)}
            </span>
            <span>{lines.length} строк</span>
            <span>{editorContent.length} симв.</span>
          </div>
        </div>
      )}

      {/* 3. IN-FILE SEARCH POPUP BAR */}
      {showSearch && selectedFile && (
        <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-900 border-b border-white/10 text-xs font-sans animate-fadeIn">
          <Search size={13} className="text-slate-400 shrink-0" />
          <input
            ref={searchInputRef}
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Найти в файле..."
            className="flex-1 bg-transparent text-white text-xs placeholder-slate-500 focus:outline-none font-mono"
            autoFocus
          />
          {searchQuery && (
            <span className="text-[11px] font-mono text-slate-400">
              {searchMatchesCount} совпадений
            </span>
          )}
          <button
            type="button"
            onClick={() => {
              setShowSearch(false);
              setSearchQuery('');
            }}
            className="p-1 rounded hover:bg-white/10 text-slate-400 hover:text-white"
          >
            <X size={12} />
          </button>
        </div>
      )}

      {/* 4. CODE EDITOR / VIEWER WORKSPACE */}
      <div className="flex-1 overflow-auto flex relative select-text">
        {selectedFile ? (
          isEditing ? (
            /* Interactive Code Textarea with Line Numbers */
            <div className="flex-1 w-full h-full flex overflow-hidden">
              {/* Line Numbers Gutter */}
              <div
                className="text-right text-theme-muted/50 font-mono select-none px-3 py-2 border-r border-theme-border bg-theme-panel/50 shrink-0 h-full overflow-hidden"
                style={{ fontSize: `${fontSize}px`, lineHeight: `${fontSize * 1.5}px` }}
              >
                {lines.map((_, i) => (
                  <div key={i} className="min-w-[28px]">
                    {i + 1}
                  </div>
                ))}
              </div>

              {/* Editable Textarea */}
              <textarea
                value={editorContent}
                onChange={(e) => setEditorContent(e.target.value)}
                spellCheck={false}
                wrap={wordWrap ? 'on' : 'off'}
                className="flex-1 w-full h-full p-2 bg-transparent text-slate-100 font-mono resize-none focus:outline-none leading-normal border-none"
                style={{
                  fontSize: `${fontSize}px`,
                  lineHeight: `${fontSize * 1.5}px`,
                  whiteSpace: wordWrap ? 'pre-wrap' : 'pre',
                }}
              />
            </div>
          ) : (
            /* Syntax Highlighted View Mode */
            <div className="flex-1 flex overflow-auto p-2" style={{ fontSize: `${fontSize}px` }}>
              {/* Line Numbers */}
              <div
                className="text-right text-theme-muted/50 font-mono select-none pr-3 border-r border-theme-border sticky left-0 bg-theme-bg h-fit"
                style={{ lineHeight: `${fontSize * 1.5}px` }}
              >
                {lines.map((_, i) => (
                  <div key={i} className="min-w-[28px]">
                    {i + 1}
                  </div>
                ))}
              </div>

              {/* Highlighted Code Lines */}
              <pre
                className="flex-1 pl-3 select-text overflow-visible m-0"
                style={{
                  lineHeight: `${fontSize * 1.5}px`,
                  whiteSpace: wordWrap ? 'pre-wrap' : 'pre',
                }}
              >
                <code>
                  {lines.map((line, i) => (
                    <div key={i}>
                      {renderSafeHighlightedLine(line)}
                    </div>
                  ))}
                </code>
              </pre>
            </div>
          )
        ) : (
          /* Empty Editor State */
          <div className="flex-1 flex flex-col items-center justify-center text-center select-none text-theme-muted space-y-3 font-sans p-6">
            <div className="w-12 h-12 rounded-xl border border-theme-border bg-theme-panel flex items-center justify-center text-emerald-400 shadow-xl">
              <FileCode size={24} />
            </div>
            <div className="space-y-1">
              <div className="text-sm font-semibold text-theme-text">Редактор файлов пуст</div>
              <div className="text-xs text-theme-muted max-w-xs leading-relaxed">
                Выберите файл в дереве файлов слева или откройте воркспейс для работы с проектом.
              </div>
            </div>
          </div>
        )}
      </div>

    </div>
  );
};
