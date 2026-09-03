import React from 'react';
import {
  RotateCcw,
  Check,
  Lock,
} from 'lucide-react';
import { ToolDefinition } from '../../../types';
import { useI18n } from '../../../i18n';
import { Card } from '../../ui/Card';
import { Badge } from '../../ui/Badge';
import { Toggle } from '../../ui/Toggle';
import { SettingsSection } from '../common';

interface ToolsRegistryViewProps {
  tools: ToolDefinition[];
  loadingTools: boolean;
  toolsSuccessMsg: string | null;
  onToggleTool: (toolId: string, enabled: boolean) => void;
  getCategoryIcon: (category: string) => React.ReactNode;
  getCategoryLabel: (category: string) => string;
}

const CATEGORIES = ['files', 'web', 'terminal', 'memory', 'interactive'] as const;

export const ToolsRegistryView: React.FC<ToolsRegistryViewProps> = ({
  tools,
  loadingTools,
  toolsSuccessMsg,
  onToggleTool,
  getCategoryIcon,
  getCategoryLabel,
}) => {
  const { t } = useI18n();

  return (
    <div className="space-y-6">
      <SettingsSection
        title={t.settings.toolsTab.toolsManagementTitle}
        description={t.settings.toolsTab.toolsManagementDesc}
      >
        <Card variant="default" className="p-6 space-y-6 rounded-2xl">
          {toolsSuccessMsg && (
            <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 text-xs flex items-center gap-2 animate-fadeIn">
              <Check size={14} />
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
              {CATEGORIES.map((catKey) => {
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
