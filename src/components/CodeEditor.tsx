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
  // Simple regex syntax highlighting function
  const highlightCode = (code: string) => {
    // Escape HTML characters
    let html = code
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');

    // Comments (both single-line and multi-line)
    html = html.replace(/(\/\/.*)/g, '<span class="text-neutral-500">$1</span>');
    html = html.replace(/(\/\*[\s\S]*?\*\/)/g, '<span class="text-neutral-500">$1</span>');

    // Strings
    html = html.replace(/(["'`])(.*?)\1/g, '<span class="text-emerald-400">$1$2$1</span>');

    // Keywords (JS, TS, Rust, CSS, HTML, Cargo)
    const keywords = /\b(const|let|var|function|return|import|export|from|default|class|interface|type|extends|implements|pub|struct|fn|impl|use|enum|match|if|else|for|while|async|await|true|false|null|undefined|void|string|number|boolean|any|as|in|of|let|mut|extern|crate|mod|where|dyn|static|self|Self)\b/g;
    html = html.replace(keywords, '<span class="text-amber-500 font-bold">$1</span>');

    // Functions calls
    html = html.replace(/\b([a-zA-Z_]\w*)(?=\()/g, '<span class="text-sky-400">$1</span>');

    // Numbers
    html = html.replace(/\b(\d+)\b/g, '<span class="text-violet-400">$1</span>');

    return html;
  };

  const lines = selectedFile ? selectedFile.content.split('\n') : [];

  return (
    <div className="h-full w-full bg-[#1e1e1e] text-[#d4d4d4] flex flex-col font-mono text-xs overflow-hidden select-text border-r border-black">
      {/* Editor Tabs Bar */}
      <div className="flex items-center overflow-x-auto bg-[#181818] border-b border-[#2d2d2d] select-none scrollbar-none shrink-0">
        {openTabs.map((tab) => {
          const isActive = selectedFile && selectedFile.path === tab.path;
          return (
            <div
              key={tab.path}
              onClick={() => onSelectTab(tab.path)}
              className={`group flex items-center gap-2 px-4 py-2 border-r border-[#2b2b2b] cursor-pointer transition-colors ${
                isActive
                  ? 'bg-[#1e1e1e] text-white border-t-2 border-orange-500'
                  : 'bg-[#141414] text-neutral-400 hover:bg-[#1b1b1b] hover:text-neutral-200'
              }`}
            >
              <FileCode size={12} className={isActive ? 'text-orange-400' : 'text-neutral-500'} />
              <span className="truncate max-w-[100px]">{tab.name}</span>
              <button
                onClick={(e) => onCloseTab(tab.path, e)}
                className="p-0.5 rounded hover:bg-[#2d2d2d] text-neutral-500 hover:text-white transition-colors cursor-pointer"
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
            <div className="text-right text-neutral-600 select-none pr-4 border-r border-[#2d2d2d] sticky left-0 bg-[#1e1e1e] h-fit">
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
          <div className="flex-1 flex flex-col items-center justify-center text-center select-none text-neutral-500 space-y-3">
            <div className="w-16 h-16 rounded-full border border-[#2d2d2d] flex items-center justify-center text-neutral-600">
              <FileCode size={32} />
            </div>
            <div>
              <div className="font-bold text-neutral-400">No File Open</div>
              <div className="text-[10px] mt-1">Select a file from the sidebar to display it in the editor.</div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
