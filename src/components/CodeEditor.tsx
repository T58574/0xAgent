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
  const [fontSize, setFontSize] = useState<number>(14); // px
  
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
        parts.push(<span key={key} className="opacity-40 text-[var(--theme-text-muted)] italic">{comment}</span>);
      } else if (stringLit) {
        parts.push(<span key={key} className="text-[var(--theme-text)] font-semibold">{stringLit}</span>);
      } else if (keyword) {
        parts.push(<span key={key} className="text-[var(--theme-text)] font-bold">{keyword}</span>);
      } else if (fnCall) {
        parts.push(<span key={key} className="text-[var(--theme-text)] font-bold">{fnCall}</span>);
      } else if (numberLit) {
        parts.push(<span key={key} className="text-[var(--theme-text-muted)] font-semibold">{numberLit}</span>);
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
    <div className="h-full w-full bg-[var(--theme-bg)] text-[var(--theme-text)] flex flex-col text-xs overflow-hidden select-text font-sans">
      
      {/* 1. IDE EDITOR TABS BAR */}
      <div className="flex items-center justify-between bg-[var(--theme-panel)] border-b border-[var(--theme-border)] select-none shrink-0">
        
        {/* Open File Tabs */}
        <div className="flex items-center overflow-x-auto scrollbar-none flex-1 min-w-0">
          {openTabs.map((tab) => {
            const isActive = selectedFile && selectedFile.path === tab.path;
            const tabIsDirty = isActive ? isDirty : tab.isDirty;

            return (
              <div
                key={tab.path}
                onClick={() => onSelectTab(tab.path)}
                className={`group flex items-center gap-2 px-3.5 py-2.5 border-r border-[var(--theme-border)] cursor-pointer transition-all shrink-0 ${
                  isActive
                    ? 'bg-[var(--theme-card-bg)] text-[var(--theme-text)] border-t-2 border-[var(--theme-accent)] font-bold shadow-sm'
                    : 'bg-[var(--theme-input-bg)] text-[var(--theme-text-muted)] hover:text-[var(--theme-text)] hover:bg-[var(--theme-border-subtle)]'
                }`}
              >
                <FileCode size={14} className={isActive ? 'text-[var(--theme-text)]' : 'text-[var(--theme-text-muted)]'} />
                
                <span className="truncate max-w-[140px] text-xs font-semibold">
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
                  className="p-0.5 rounded hover:bg-rose-500/20 text-[var(--theme-text-muted)] hover:text-rose-500 transition-colors cursor-pointer"
                  title="Закрыть вкладку"
                >
                  <X size={13} />
                </button>
              </div>
            );
          })}
        </div>

        {/* Editor Quick Actions Toolbar */}
        {selectedFile && (
          <div className="flex items-center gap-1.5 px-3 shrink-0 border-l border-[var(--theme-border)] bg-[var(--theme-card-bg)] py-1.5">
            
            {/* Save Button */}
            <button
              type="button"
              onClick={handleSave}
              disabled={isSaving || !isDirty}
              className={`px-3 py-1 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer shadow-sm ${
                isDirty
                  ? 'bg-[var(--theme-accent)] text-[var(--theme-accent-text)] border border-[var(--theme-accent)]'
                  : 'text-[var(--theme-text-muted)] opacity-50 cursor-not-allowed border border-[var(--theme-border)]'
              }`}
              title="Сохранить файл (Ctrl+S)"
            >
              <Save size={13} className={isSaving ? 'animate-spin' : ''} />
              <span className="hidden lg:inline">{isSaving ? 'Сохранение...' : 'Сохранить'}</span>
            </button>

            {/* Mode Toggle (Edit / View) */}
            <button
              type="button"
              onClick={() => setIsEditing(!isEditing)}
              className={`p-1.5 rounded-lg border transition-colors cursor-pointer ${
                isEditing
                  ? 'bg-[var(--theme-border-subtle)] text-[var(--theme-text)] border-[var(--theme-border)]'
                  : 'text-[var(--theme-text-muted)] hover:text-[var(--theme-text)] border-transparent'
              }`}
              title={isEditing ? 'Режим: Редактирование' : 'Режим: Просмотр (Read-Only)'}
            >
              {isEditing ? <Eye size={14} /> : <Edit3 size={14} />}
            </button>

            {/* Search Trigger */}
            <button
              type="button"
              onClick={() => setShowSearch(!showSearch)}
              className={`p-1.5 rounded-lg border transition-colors cursor-pointer ${
                showSearch
                  ? 'bg-[var(--theme-border-subtle)] text-[var(--theme-text)] border-[var(--theme-border)]'
                  : 'text-[var(--theme-text-muted)] hover:text-[var(--theme-text)] border-transparent'
              }`}
              title="Поиск в файле (Ctrl+F)"
            >
              <Search size={14} />
            </button>

            {/* Word Wrap Toggle */}
            <button
              type="button"
              onClick={() => setWordWrap(!wordWrap)}
              className={`p-1.5 rounded-lg border transition-colors cursor-pointer ${
                wordWrap
                  ? 'bg-[var(--theme-border-subtle)] text-[var(--theme-text)] border-[var(--theme-border)]'
                  : 'text-[var(--theme-text-muted)] hover:text-[var(--theme-text)] border-transparent'
              }`}
              title={wordWrap ? 'Перенос строк: Вкл' : 'Перенос строк: Выкл'}
            >
              <WrapText size={14} />
            </button>

            {/* Font Zoom Controls */}
            <button
              type="button"
              onClick={() => setFontSize((prev) => Math.max(10, prev - 1))}
              className="p-1.5 rounded text-[var(--theme-text-muted)] hover:text-[var(--theme-text)] cursor-pointer"
              title="Уменьшить шрифт"
            >
              <ZoomOut size={14} />
            </button>
            <button
              type="button"
              onClick={() => setFontSize((prev) => Math.min(22, prev + 1))}
              className="p-1.5 rounded text-[var(--theme-text-muted)] hover:text-[var(--theme-text)] cursor-pointer"
              title="Увеличить шрифт"
            >
              <ZoomIn size={14} />
            </button>

            {/* Copy Code */}
            <button
              type="button"
              onClick={handleCopyCode}
              className="p-1.5 rounded text-[var(--theme-text-muted)] hover:text-[var(--theme-text)] cursor-pointer"
              title="Скопировать весь код"
            >
              {copied ? <Check size={14} className="text-emerald-500" /> : <Copy size={14} />}
            </button>
          </div>
        )}
      </div>

      {/* 2. IDE BREADCRUMBS BAR */}
      {selectedFile && (
        <div className="flex items-center justify-between px-4 py-1.5 bg-[var(--theme-panel)]/80 border-b border-[var(--theme-border)] text-xs text-[var(--theme-text-muted)] select-none shrink-0 font-medium">
          <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none min-w-0">
            <Folder size={13} className="text-[var(--theme-text-muted)] shrink-0" />
            {pathSegments.map((seg, idx) => {
              const isLast = idx === pathSegments.length - 1;
              return (
                <React.Fragment key={idx}>
                  {idx > 0 && <ChevronRight size={11} className="text-[var(--theme-text-muted)] opacity-60 shrink-0" />}
                  <span className={`truncate ${isLast ? 'text-[var(--theme-text)] font-bold' : 'text-[var(--theme-text-muted)]'}`}>
                    {seg}
                  </span>
                </React.Fragment>
              );
            })}
          </div>

          <div className="flex items-center gap-2.5 shrink-0 text-xs text-[var(--theme-text-muted)] font-semibold">
            <span className="px-2 py-0.5 rounded-md bg-[var(--theme-input-bg)] border border-[var(--theme-border)] text-[var(--theme-text)]">
              {detectLanguage(selectedFile.name)}
            </span>
            <span>{lines.length} строк</span>
            <span>{editorContent.length.toLocaleString()} симв.</span>
          </div>
        </div>
      )}

      {/* 3. IN-FILE SEARCH POPUP BAR */}
      {showSearch && selectedFile && (
        <div className="flex items-center gap-2 px-4 py-2 bg-[var(--theme-card-bg)] border-b border-[var(--theme-border)] text-xs shadow-md animate-fadeIn">
          <Search size={14} className="text-[var(--theme-text-muted)] shrink-0" />
          <input
            ref={searchInputRef}
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Найти в файле..."
            className="flex-1 bg-transparent text-[var(--theme-text)] text-xs placeholder-[var(--theme-text-muted)] focus:outline-none"
            autoFocus
          />
          {searchQuery && (
            <span className="text-xs font-semibold text-[var(--theme-text-muted)]">
              {searchMatchesCount} совпадений
            </span>
          )}
          <button
            type="button"
            onClick={() => {
              setShowSearch(false);
              setSearchQuery('');
            }}
            className="p-1 rounded hover:bg-[var(--theme-border-subtle)] text-[var(--theme-text-muted)] hover:text-[var(--theme-text)] cursor-pointer"
          >
            <X size={13} />
          </button>
        </div>
      )}

      {/* 4. CODE EDITOR / VIEWER WORKSPACE */}
      <div className="flex-1 overflow-auto flex relative select-text scrollbar-thin">
        {selectedFile ? (
          isEditing ? (
            /* Interactive Code Textarea with Line Numbers */
            <div className="flex-1 w-full h-full flex overflow-hidden">
              {/* Line Numbers Gutter */}
              <div
                className="text-right text-[var(--theme-text-muted)] font-mono select-none px-3 py-2.5 border-r border-[var(--theme-border)] bg-[var(--theme-panel)]/50 shrink-0 h-full overflow-hidden opacity-60 font-semibold"
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
                className="flex-1 w-full h-full p-2.5 bg-transparent text-[var(--theme-text)] font-mono resize-none focus:outline-none leading-normal border-none"
                style={{
                  fontSize: `${fontSize}px`,
                  lineHeight: `${fontSize * 1.5}px`,
                  whiteSpace: wordWrap ? 'pre-wrap' : 'pre',
                }}
              />
            </div>
          ) : (
            /* Syntax Highlighted View Mode */
            <div className="flex-1 flex overflow-auto p-2.5" style={{ fontSize: `${fontSize}px` }}>
              {/* Line Numbers */}
              <div
                className="text-right text-[var(--theme-text-muted)] font-mono select-none pr-3 border-r border-[var(--theme-border)] sticky left-0 bg-[var(--theme-bg)] h-fit opacity-60 font-semibold"
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
                className="flex-1 pl-3 select-text overflow-visible m-0 text-[var(--theme-text)]"
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
          <div className="flex-1 flex flex-col items-center justify-center text-center select-none text-[var(--theme-text-muted)] space-y-3 font-sans p-6 h-full">
            <div className="w-14 h-14 rounded-2xl border border-[var(--theme-border)] bg-[var(--theme-card-bg)] flex items-center justify-center text-[var(--theme-text)] shadow-sm">
              <FileCode size={26} />
            </div>
            <div className="space-y-1">
              <div className="text-base font-bold text-[var(--theme-text)]">Редактор файлов пуст</div>
              <div className="text-xs text-[var(--theme-text-muted)] max-w-xs leading-relaxed font-medium">
                Выберите файл в дереве файлов слева или откройте воркспейс для работы с проектом.
              </div>
            </div>
          </div>
        )}
      </div>

    </div>
  );
};
