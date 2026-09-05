import React, { useState, useEffect, useRef } from 'react';
import { Plus, ChevronDown, Sparkles, MessageSquare, FolderPlus } from 'lucide-react';
import { useI18n } from '../../i18n';

interface SidebarNewChatMenuProps {
  onCreateChat: (title?: string, wsDir?: string | null) => void;
  onSelectWorkspace: () => void;
  workspaceDir?: string | null;
}

export const SidebarNewChatMenu: React.FC<SidebarNewChatMenuProps> = ({
  onCreateChat,
  onSelectWorkspace,
}) => {
  const { t } = useI18n();
  const [showMenu, setShowMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div ref={menuRef} className="relative flex items-center gap-1.5">
      <button
        type="button"
        onClick={() => onCreateChat()}
        className="flex-1 py-2 px-3.5 rounded-xl bg-[var(--theme-card-bg)] hover:bg-[var(--theme-border-subtle)] border border-[var(--theme-border)] text-[var(--theme-text)] font-semibold text-xs flex items-center justify-center gap-2 shadow-xs transition-all duration-150 cursor-pointer group active:scale-[0.98]"
        title={t.sidebar.newChatTooltip}
      >
        <Plus size={14} className="transition-transform group-hover:rotate-90 text-[var(--theme-text-muted)] group-hover:text-[var(--theme-text)]" />
        <span>{t.nav.newChat}</span>
      </button>

      <button
        type="button"
        onClick={() => setShowMenu(!showMenu)}
        className="p-2 rounded-xl bg-[var(--theme-card-bg)] border border-[var(--theme-border)] text-[var(--theme-text-muted)] hover:text-[var(--theme-text)] hover:bg-[var(--theme-border-subtle)] transition-all cursor-pointer shadow-xs active:scale-[0.98]"
        title={t.nav.workspaceMenu}
      >
        <ChevronDown size={14} className={`transition-transform duration-200 ${showMenu ? 'rotate-180' : ''}`} />
      </button>

      {showMenu && (
        <div className="absolute top-full left-0 right-0 mt-1.5 p-1.5 shadow-2xl border border-[var(--theme-border)] bg-[var(--theme-panel-solid)] backdrop-blur-2xl z-50 rounded-2xl space-y-1 animate-fadeIn">
          <button
            type="button"
            onClick={() => {
              setShowMenu(false);
              onCreateChat(t.sidebar.autoWorkspace, 'auto');
            }}
            className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-left text-xs hover:bg-[var(--theme-border-subtle)] text-[var(--theme-text)] transition-colors cursor-pointer"
          >
            <Sparkles size={14} className="text-[var(--theme-text-muted)] shrink-0" />
            <div className="flex flex-col">
              <span className="font-semibold">{t.sidebar.autoWorkspace}</span>
              <span className="text-[10px] text-[var(--theme-text-muted)]">~/.0xagent/workspaces</span>
            </div>
          </button>

          <button
            type="button"
            onClick={() => {
              setShowMenu(false);
              onCreateChat(t.sidebar.standalone, null);
            }}
            className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-left text-xs hover:bg-[var(--theme-border-subtle)] text-[var(--theme-text)] transition-colors cursor-pointer"
          >
            <MessageSquare size={14} className="text-[var(--theme-text-muted)] shrink-0" />
            <div className="flex flex-col">
              <span className="font-semibold">{t.sidebar.standalone}</span>
              <span className="text-[10px] text-[var(--theme-text-muted)]">{t.chat.context}</span>
            </div>
          </button>

          <button
            type="button"
            onClick={() => {
              setShowMenu(false);
              onSelectWorkspace();
            }}
            className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-left text-xs hover:bg-[var(--theme-border-subtle)] text-[var(--theme-text)] transition-colors cursor-pointer border-t border-[var(--theme-border)] mt-0.5 pt-2"
          >
            <FolderPlus size={14} className="text-[var(--theme-text-muted)] shrink-0" />
            <div className="flex flex-col">
              <span className="font-semibold">{t.sidebar.openWorkspace}...</span>
              <span className="text-[10px] text-[var(--theme-text-muted)]">{t.nav.changeWorkspace}</span>
            </div>
          </button>
        </div>
      )}
    </div>
  );
};
