import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { DEFAULT_SLASH_COMMANDS, SlashCommandItem } from './popovers';

interface UseSlashAutocompleteProps {
  inputText: string;
  setInputText: (text: string) => void;
  onTriggerSlashCommand?: (command: string) => void;
  textareaRef: React.RefObject<HTMLTextAreaElement | null>;
  openMenu: 'none' | 'persona' | 'model' | 'slash' | 'permission' | 'reasoning';
  setOpenMenu: (menu: 'none' | 'persona' | 'model' | 'slash' | 'permission' | 'reasoning') => void;
  onSubmit: (e: React.FormEvent) => void;
  canSubmit: boolean;
  setIsExpanded: (val: boolean) => void;
}

export function useSlashAutocomplete({
  inputText,
  setInputText,
  onTriggerSlashCommand,
  textareaRef,
  openMenu,
  setOpenMenu,
  onSubmit,
  canSubmit,
  setIsExpanded,
}: UseSlashAutocompleteProps) {
  const [slashFilter, setSlashFilter] = useState('');
  const [selectedSlashIndex, setSelectedSlashIndex] = useState(0);

  useEffect(() => {
    if (inputText.startsWith('/')) {
      setSlashFilter(inputText.slice(1).toLowerCase());
      setOpenMenu('slash');
      setSelectedSlashIndex(0);
    } else if (openMenu === 'slash') {
      setOpenMenu('none');
    }
  }, [inputText]);

  const filteredSlashCommands = useMemo(() => {
    return DEFAULT_SLASH_COMMANDS.filter(
      (c) => c.cmd.toLowerCase().includes(slashFilter) || c.label.toLowerCase().includes(slashFilter)
    );
  }, [slashFilter]);

  const handleSelectSlash = useCallback((item: SlashCommandItem) => {
    setInputText(`${item.cmd} `);
    setOpenMenu('none');
    onTriggerSlashCommand?.(item.cmd);
    textareaRef.current?.focus();
  }, [setInputText, setOpenMenu, onTriggerSlashCommand, textareaRef]);

  const handleFormSubmit = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    setIsExpanded(false);
    if (textareaRef.current) {
      textareaRef.current.style.height = '34px';
    }
    onSubmit(e);
  }, [canSubmit, setIsExpanded, textareaRef, onSubmit]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (openMenu === 'slash' && filteredSlashCommands.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedSlashIndex((p) => (p + 1) % filteredSlashCommands.length);
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedSlashIndex((p) => (p - 1 + filteredSlashCommands.length) % filteredSlashCommands.length);
        return;
      }
      if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault();
        handleSelectSlash(filteredSlashCommands[selectedSlashIndex]);
        return;
      }
    }
    if (e.key === 'Escape') {
      e.preventDefault();
      setOpenMenu('none');
      return;
    }
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleFormSubmit(e);
    }
  }, [openMenu, filteredSlashCommands, selectedSlashIndex, handleSelectSlash, setOpenMenu, handleFormSubmit]);

  return {
    filteredSlashCommands,
    selectedSlashIndex,
    handleSelectSlash,
    handleKeyDown,
    handleFormSubmit,
  };
}
