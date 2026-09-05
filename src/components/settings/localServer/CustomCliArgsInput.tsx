import React from 'react';
import { useI18n } from '../../../i18n';
import { Button } from '../../ui/Button';
import { InfoTooltip } from './atoms';

interface CustomCliArgsInputProps {
  customArgs: string;
  setCustomArgs: (val: string) => void;
}

export const CustomCliArgsInput: React.FC<CustomCliArgsInputProps> = ({
  customArgs,
  setCustomArgs,
}) => {
  const { t } = useI18n();

  return (
    <div className="space-y-1.5 pt-1">
      <div className="flex justify-between items-center text-xs">
        <div className="flex items-center">
          <label className="text-[11px] font-semibold text-[var(--theme-text-muted)]">
            {t.settings.localServer.params.customArgsLabel}
          </label>
          <InfoTooltip
            title="CLI Custom Args"
            text="Direct CLI arguments for llama-server.exe. e.g. -ctk q8_0 -ctv q8_0 saves 50% VRAM."
            benefit="KV quantization doubles context capacity"
          />
        </div>
        <div className="flex gap-1.5">
          <Button
            variant={customArgs.includes('q8_0') ? 'accent' : 'secondary'}
            size="xs"
            onClick={() => setCustomArgs('-ctk q8_0 -ctv q8_0')}
            title="8-bit KV cache quantization (saves 50% VRAM)"
          >
            Q8_0 KV
          </Button>
          <Button
            variant={customArgs.includes('q4_0') ? 'accent' : 'secondary'}
            size="xs"
            onClick={() => setCustomArgs('-ctk q4_0 -ctv q4_0')}
            title="4-bit KV cache quantization (max VRAM savings)"
          >
            Q4_0 KV
          </Button>
          {customArgs && (
            <Button
              variant="ghost"
              size="xs"
              onClick={() => setCustomArgs('')}
              title={t.settings.localServer.params.clearBtn}
            >
              [x]
            </Button>
          )}
        </div>
      </div>
      <input
        type="text"
        value={customArgs}
        onChange={(e) => setCustomArgs(e.target.value)}
        placeholder="-ctk q8_0 -ctv q8_0"
        className="w-full px-3 py-2 rounded-xl bg-[var(--theme-input-bg)] border border-[var(--theme-border)] text-xs font-mono text-[var(--theme-text)] focus:border-[var(--theme-accent)] focus:outline-none transition-colors"
      />
    </div>
  );
};
