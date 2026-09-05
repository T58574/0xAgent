import React from 'react';
import { RotateCcw, Lock, Terminal, Brain, Search, MessageSquare, FileCode, Layers } from 'lucide-react';
import { ToolDefinition } from '../../../types';
import { Badge } from '../../ui/Badge';
import { Card } from '../../ui/Card';
import { Toggle } from '../../ui/Toggle';
import { SettingsSection } from '../common';
import { useI18n } from '../../../i18n';

interface ToolsRegistrySectionProps {
  tools: ToolDefinition[];
  loadingTools: boolean;
  toolsSuccessMsg: string | null;
  onToggleTool: (toolId: string, enabled: boolean) => void;
}

export const ToolsRegistrySection: React.FC<ToolsRegistrySectionProps> = ({
  tools,
  loadingTools,
  toolsSuccessMsg,
  onToggleTool,
}) => {
  const { t } = useI18n();

  const categories = ['files', 'web', 'terminal', 'memory', 'interactive'] as const;

  const getCategoryLabel = (category: string) => {
    switch (category) {
      case 'files':
        return t.settings.toolsTab.catFiles;
      case 'web':
        return t.settings.toolsTab.catWeb;
      case 'memory':
        return t.settings.toolsTab.catMemory;
      case 'terminal':
        return t.settings.toolsTab.catTerminal;
      case 'interactive':
        return t.settings.toolsTab.catInteractive;
      default:
        return category;
    }
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'files':
        return <FileCode size={14} className="text-sky-400" />;
      case 'web':
        return <Search size={14} className="text-cyan-400" />;
      case 'memory':
        return <Brain size={14} className="text-purple-400" />;
      case 'terminal':
        return <Terminal size={14} className="text-emerald-400" />;
      case 'interactive':
        return <MessageSquare size={14} className="text-pink-400" />;
      default:
        return <Layers size={14} className="text-[var(--theme-text-muted)]" />;
    }
  };

  return (
    <div className="space-y-6">
      <SettingsSection
        title={t.settings.toolsTab.toolsManagementTitle}
        description={t.settings.toolsTab.toolsManagementDesc}
      >
        <Card variant="default" className="p-6 space-y-6 rounded-2xl">
          {toolsSuccessMsg && (
            <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 text-xs flex items-center gap-2 animate-fadeIn">
              <span>{toolsSuccessMsg}</span>
            </div>
          )}

          {loadingTools ? (
            <div className="py-12 flex items-center justify-center gap-2 text-xs text-[var(--theme-text-muted)]">
              <RotateCcw size={14} className="animate-spin" />
              <span>{t.settings.toolsTab.loadingRegistry}</span>
            </div>
          ) : (
            <div className="space-y-6">
              {categories.map((catKey) => {
                const catTools = tools.filter((t) => t.category === catKey);
                if (catTools.length === 0) return null;

                return (
                  <div key={catKey} className="space-y-3">
                    <div className="flex items-center gap-2 px-1">
                      {getCategoryIcon(catKey)}
                      <span className="text-xs font-bold text-[var(--theme-text)] uppercase tracking-wider">
                        {getCategoryLabel(catKey)}
                      </span>
                      <span className="text-[10px] font-mono text-[var(--theme-text-muted)] font-semibold">
                        ({catTools.filter((t) => t.enabled).length}/{catTools.length})
                      </span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {catTools.map((tool) => (
                        <div
                          key={tool.id}
                          className={`p-4 rounded-2xl border transition-all flex items-start justify-between gap-3.5 ${
                            tool.enabled
                              ? 'bg-[var(--theme-card-bg)] border-[var(--theme-border)] shadow-xs'
                              : 'bg-[var(--theme-input-bg)] border-dashed border-[var(--theme-border)]/60 opacity-60'
                          }`}
                        >
                          <div className="min-w-0 flex-1 space-y-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-mono text-xs font-bold text-[var(--theme-text)]">
                                &lt;{tool.name}&gt;
                              </span>
                              {tool.requiresApproval && (
                                <Badge variant="warning" size="xs" icon={<Lock size={9} />}>
                                  Approval
                                </Badge>
                              )}
                            </div>
                            <p className="text-[11.5px] text-[var(--theme-text-muted)] leading-relaxed line-clamp-2">
                              {tool.description}
                            </p>
                          </div>

                          <Toggle
                            checked={tool.enabled}
                            onChange={(val) => onToggleTool(tool.id, val)}
                            size="sm"
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Card>
      </SettingsSection>
    </div>
  );
};
