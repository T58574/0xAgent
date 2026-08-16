import { useEffect } from 'react';

interface UseAppShortcutsParams {
  onCreateSession: () => void;
  onToggleSidebar?: () => void;
  onOpenSettings?: () => void;
  onCancelAgent?: () => void;
}

export function useAppShortcuts({
  onCreateSession,
  onToggleSidebar,
  onOpenSettings,
  onCancelAgent,
}: UseAppShortcutsParams) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const isInput = target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable);

      // Ctrl + N (New Chat)
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'n' && !e.shiftKey && !e.altKey) {
        if (isInput) return;
        e.preventDefault();
        onCreateSession();
        return;
      }

      // Ctrl + B (Toggle Sidebar)
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'b' && !e.shiftKey && !e.altKey) {
        if (isInput) return;
        e.preventDefault();
        onToggleSidebar && onToggleSidebar();
        return;
      }

      // Ctrl + , (Open Settings)
      if ((e.ctrlKey || e.metaKey) && e.key === ',' && !e.shiftKey && !e.altKey) {
        e.preventDefault();
        onOpenSettings && onOpenSettings();
        return;
      }

      // Escape (Cancel running agent action)
      if (e.key === 'Escape') {
        onCancelAgent && onCancelAgent();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onCreateSession, onToggleSidebar, onOpenSettings, onCancelAgent]);
}
