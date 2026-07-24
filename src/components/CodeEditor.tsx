
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
  // FIXED: Proper HTML escaping and sanitization to prevent XSS injection
  const highlightCode = (code: string) => {
    let html = code;

    // Escape ALL HTML characters FIRST (before any replacements) - critical for security
    html = html.replace(/&/g, '&amp;')
               .replace(/</g, '&lt;')
               .replace(/>/g, '&gt;');

    // Comments (both single-line and multi-line) - use non-capturing groups to prevent injection
    html = html.replace(/(\/\/.*)/g, '<span class="opacity-50 font-sans italic" title="$1">$1</span>');
    html = html.replace(/(\/\*[\s\S]*?\*\/)/g, '<span class="opacity-50 font-sans italic" title="$1">$1</span>');

    // Strings - escape quotes in content to prevent breaking HTML attributes
    html = html.replace(/(["'`])(.*?)\1/g, (_match, quote, content) => {
      const safeContent = content.replace(/"/g, '&quot;').replace(/'/g, '&#39;');
      return `<span class="text-emerald-500 font-bold" title="${quote}${safeContent}${quote}">${quote}${content}${quote}</span>`;
    });

    // Keywords (JS, TS, Rust, CSS, HTML, Cargo) - escape in content to prevent injection
    const keywords = /\b(const|let|var|function|return|import|export|from|default|class|interface|type|extends|implements|pub|struct|fn|impl|use|enum|match|if|else|for|while|async|await|true|false|null|undefined|void|string|number|boolean|any|as|in|of|let|mut|extern|crate|mod|where|dyn|static|self|Self)\b/g;
    html = html.replace(keywords, (match) => `<span class="text-amber-600 font-bold" title="${match}">${match}</span>`);

    // Functions calls - escape in content to prevent injection
    html = html.replace(/\b([a-zA-Z_]\w*)(?=\()/g, (match) => `<span class="text-sky-600 font-semibold" title="${match}()">${match}</span>`);

    // Numbers - escape in content to prevent injection
    html = html.replace(/\b(\d+)\b/g, (match) => `<span class="text-violet-650 font-semibold" title="${match}">${match}</span>`);

    return html;
  };

  const lines = selectedFile ? selectedFile.content.split('\n') : [];

  return (
    <div className="h-full w-full bg-theme-bg text-theme-text flex flex-col font-mono text-xs overflow-hidden select-text border-r border-theme-border">
      {/* Editor Tabs Bar */}
      <div className="flex items-center overflow-x-auto bg-theme-bg border-b border-theme-border select-none scrollbar-none shrink-0">
        {openTabs.map((tab) => {
          const isActive = selectedFile && selectedFile.path === tab.path;
          return (
            <div
              key={tab.path}
              onClick={() => onSelectTab(tab.path)}
              className={`group flex items-center gap-2 px-4 py-2 border-r border-theme-border cursor-pointer transition-colors ${
                isActive
                  ? 'bg-theme-active text-theme-text border-t-2 border-theme-text font-bold'
                  : 'bg-theme-bg text-theme-text/60 hover:bg-theme-active hover:text-theme-text'
              }`}
            >
              <FileCode size={12} className={isActive ? 'text-theme-text' : 'text-theme-text/40'} />
              <span className="truncate max-w-[100px]">{tab.name}</span>
              <button
                onClick={(e) => onCloseTab(tab.path, e)}
                className="p-0.5 rounded hover:bg-theme-active text-theme-text/40 hover:text-theme-text transition-colors cursor-pointer"
              >
                <X size={10} />
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
            <div className="text-right text-theme-text/40 select-none pr-4 border-r border-theme-border sticky left-0 bg-theme-bg h-fit">
              {lines.map((_, i) => (
                <div key={i} className="leading-5 h-5 min-w-[20px]">
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
          <div className="flex-1 flex flex-col items-center justify-center text-center select-none text-theme-text/40 space-y-3">
            <div className="w-16 h-16 rounded-full border border-theme-border flex items-center justify-center text-theme-text/30">
              <FileCode size={32} />
            </div>
            <div>
              <div className="font-bold text-theme-text/60">No File Open</div>
              <div className="text-[10px] mt-1">Select a file from the sidebar to display it in the editor.</div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
