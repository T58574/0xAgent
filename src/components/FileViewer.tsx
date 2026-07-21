import React from 'react';
import { X, Copy, Check } from 'lucide-react';

interface FileViewerProps {
  fileName: string;
  filePath: string;
  content: string;
  onClose: () => void;
}

export const FileViewer: React.FC<FileViewerProps> = ({
  fileName,
  filePath,
  content,
  onClose,
}) => {
  const [copied, setCopied] = React.useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/40 backdrop-blur-xs select-text">
      <div className="relative w-full max-w-4xl h-[85vh] border border-black rounded-2xl bg-white shadow-2xl flex flex-col overflow-hidden text-black">
        
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-black bg-neutral-50">
          <div>
            <div className="text-[10px] font-bold text-neutral-500 uppercase font-sans">Raw file viewer</div>
            <div className="text-sm font-bold font-mono">{fileName}</div>
            <div className="text-[10px] text-neutral-450 font-mono truncate max-w-[500px] mt-0.5" title={filePath}>
              {filePath}
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <button
              onClick={handleCopy}
              className="flex items-center gap-1 px-4 py-1.5 rounded-full border border-black bg-white hover:bg-neutral-100 text-xs font-bold cursor-pointer transition-colors focus:outline-none"
            >
              {copied ? <Check size={12} className="text-green-600" /> : <Copy size={12} />}
              <span>{copied ? 'Copied' : 'Copy'}</span>
            </button>
            <button
              onClick={onClose}
              className="p-1 rounded-full border border-black hover:bg-neutral-200 text-black cursor-pointer transition-colors focus:outline-none"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-grow overflow-auto p-6 bg-neutral-50 font-mono text-xs text-neutral-800 select-text leading-relaxed whitespace-pre-wrap border-t border-neutral-255">
          {content || <span className="text-neutral-400 italic">Empty file</span>}
        </div>
      </div>
    </div>
  );
};
