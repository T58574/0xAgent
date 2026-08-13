import React from 'react';
import { MaterialIcon } from './common/MaterialIcon';

interface CodeEditorProps {
  selectedFile: { path: string; name: string; content: string } | null;
  openTabs: { path: string; name: string; content: string }[];
  onSelectTab: (path: string) => void;
  onCloseTab: (path: string, e: React.MouseEvent) => void;
}

export const CodeEditor: React.FC<CodeEditorProps> = ({
  selectedFile,
  openTabs,
  onSelectTab,
  onCloseTab,
}) => {
  const renderSafeHighlightedLine = (code: string): React.ReactNode => {
    if (!code) return '\u00A0';

    // Tokenize comments, strings, keywords, function calls, numbers
    const tokenRegex = /(\/\/.*|\/\*[\s\S]*?\*\/)|(["'].*?["'])|\b(const|let|var|function|return|import|export|from|default|class|interface|type|extends|implements|pub|struct|fn|impl|use|enum|match|if|else|for|while|async|await|true|false|null|undefined|void|string|number|boolean|any|as|in|of|mut|extern|crate|mod|where|dyn|static|self|Self)\b|\b([a-zA-Z_]\w*)(?=\()|\b(\d+)\b/g;

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
        parts.push(<span key={key} className="text-theme-accent font-medium">{fnCall}</span>);
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

  const lines = selectedFile ? selectedFile.content.split('\n') : [];

  return (
    <div className="h-full w-full bg-theme-bg text-theme-text flex flex-col font-mono text-xs overflow-hidden select-text">
      {/* Editor Tabs Bar */}
      <div className="flex items-center overflow-x-auto bg-theme-panel border-b border-theme-border select-none scrollbar-none shrink-0 font-sans">
        {openTabs.map((tab) => {
          const isActive = selectedFile && selectedFile.path === tab.path;
          return (
            <div
              key={tab.path}
              onClick={() => onSelectTab(tab.path)}
              className={`group flex items-center gap-2 px-3 py-1.5 border-r border-theme-border cursor-pointer transition-all ${
                isActive
                  ? 'bg-theme-bg text-theme-text border-t-2 border-[var(--theme-accent)] font-medium'
                  : 'bg-black/20 text-theme-muted hover:bg-black/40 hover:text-theme-text'
              }`}
            >
              <MaterialIcon name="code" size={14} className={isActive ? 'text-theme-accent' : 'text-theme-muted'} />
              <span className="truncate max-w-[140px] font-mono text-xs">{tab.name}</span>
              <button
                onClick={(e) => onCloseTab(tab.path, e)}
                className="p-0.5 rounded hover:bg-rose-500/20 text-theme-muted hover:text-rose-400 transition-colors cursor-pointer"
              >
                <MaterialIcon name="close" size={12} />
              </button>
            </div>
          );
        })}
      </div>

      {/* Code Area */}
      <div className="flex-1 overflow-auto flex relative select-text p-3">
        {selectedFile ? (
          <>
            {/* Line Numbers */}
            <div className="text-right text-theme-muted/50 font-mono select-none pr-3 border-r border-theme-border sticky left-0 bg-theme-bg h-fit">
              {lines.map((_, i) => (
                <div key={i} className="leading-5 h-5 min-w-[24px]">
                  {i + 1}
                </div>
              ))}
            </div>

            {/* Code Body */}
            <pre className="flex-1 pl-3 leading-5 select-text overflow-visible whitespace-pre m-0">
              <code>
                {lines.map((line, i) => (
                  <div key={i} className="h-5">
                    {renderSafeHighlightedLine(line)}
                  </div>
                ))}
              </code>
            </pre>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-center select-none text-theme-muted space-y-2 font-sans">
            <div className="w-10 h-10 rounded-md border border-theme-border bg-theme-panel flex items-center justify-center text-theme-muted">
              <MaterialIcon name="code" size={20} />
            </div>
            <div>
              <div className="text-xs font-medium text-theme-text">Файлы не открыты</div>
              <div className="text-xs text-theme-muted mt-0.5">Выберите файл в левом дереве воркспейса.</div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
