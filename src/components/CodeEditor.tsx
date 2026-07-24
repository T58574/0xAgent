import React from 'react';
import { X, FileCode } from 'lucide-react';

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
  const highlightCode = (code: string) => {
    let html = code;

    html = html.replace(/&/g, '&amp;')
               .replace(/</g, '&lt;')
               .replace(/>/g, '&gt;');

    html = html.replace(/(\/\/.*)/g, '<span class="opacity-40 text-slate-400 italic" title="$1">$1</span>');
    html = html.replace(/(\/\*[\s\S]*?\*\/)/g, '<span class="opacity-40 text-slate-400 italic" title="$1">$1</span>');

    html = html.replace(/(["'`])(.*?)\1/g, (_match, quote, content) => {
      const safeContent = content.replace(/"/g, '&quot;').replace(/'/g, '&#39;');
      return `<span class="text-emerald-400 font-medium" title="${quote}${safeContent}${quote}">${quote}${content}${quote}</span>`;
    });

    const keywords = /\b(const|let|var|function|return|import|export|from|default|class|interface|type|extends|implements|pub|struct|fn|impl|use|enum|match|if|else|for|while|async|await|true|false|null|undefined|void|string|number|boolean|any|as|in|of|let|mut|extern|crate|mod|where|dyn|static|self|Self)\b/g;
    html = html.replace(keywords, (match) => `<span class="text-amber-400 font-medium" title="${match}">${match}</span>`);

    html = html.replace(/\b([a-zA-Z_]\w*)(?=\()/g, (match) => `<span class="text-sky-400 font-medium" title="${match}()">${match}</span>`);

    html = html.replace(/\b(\d+)\b/g, (match) => `<span class="text-emerald-300 font-medium" title="${match}">${match}</span>`);

    return html;
  };

  const lines = selectedFile ? selectedFile.content.split('\n') : [];

  return (
    <div className="h-full w-full bg-theme-bg text-slate-100 flex flex-col font-mono text-xs overflow-hidden select-text">
      {/* Editor Tabs Bar */}
      <div className="flex items-center overflow-x-auto bg-slate-900/60 border-b border-white/10 select-none scrollbar-none shrink-0 font-sans">
        {openTabs.map((tab) => {
          const isActive = selectedFile && selectedFile.path === tab.path;
          return (
            <div
              key={tab.path}
              onClick={() => onSelectTab(tab.path)}
              className={`group flex items-center gap-2 px-3.5 py-1.5 border-r border-white/10 cursor-pointer transition-all ${
                isActive
                  ? 'bg-slate-800 text-white border-t-2 border-emerald-400 font-medium'
                  : 'bg-slate-950/40 text-slate-400 hover:bg-slate-800/40 hover:text-slate-200'
              }`}
            >
              <FileCode size={13} className={isActive ? 'text-emerald-400' : 'text-slate-500'} />
              <span className="truncate max-w-[130px] font-mono text-xs">{tab.name}</span>
              <button
                onClick={(e) => onCloseTab(tab.path, e)}
                className="p-0.5 rounded hover:bg-rose-500/20 text-slate-500 hover:text-rose-400 transition-colors cursor-pointer"
              >
                <X size={11} />
              </button>
            </div>
          );
        })}
      </div>

      {/* Code Area */}
      <div className="flex-1 overflow-auto flex relative select-text p-4">
        {selectedFile ? (
          <>
            {/* Line Numbers */}
            <div className="text-right text-slate-600 font-mono select-none pr-4 border-r border-white/10 sticky left-0 bg-theme-bg h-fit">
              {lines.map((_, i) => (
                <div key={i} className="leading-5 h-5 min-w-[24px]">
                  {i + 1}
                </div>
              ))}
            </div>

            {/* Code Body */}
            <pre className="flex-1 pl-4 leading-5 select-text overflow-visible whitespace-pre m-0">
              <code>
                {lines.map((line, i) => (
                  <div
                    key={i}
                    className="h-5"
                    dangerouslySetInnerHTML={{
                      __html: highlightCode(line) || '&nbsp;',
                    }}
                  />
                ))}
              </code>
            </pre>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-center select-none text-slate-500 space-y-2.5 font-sans">
            <div className="w-12 h-12 rounded-md border border-white/10 bg-slate-900/40 flex items-center justify-center text-slate-600">
              <FileCode size={24} />
            </div>
            <div>
              <div className="text-xs font-medium text-slate-400">Файлы не открыты</div>
              <div className="text-xs text-slate-500 mt-1">Выберите файл в левой панели воркспейса.</div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
