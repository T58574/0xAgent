import React, { useState, useEffect } from 'react';
import { Brain, Sparkles, X, Plus, Trash2, Save, Search } from 'lucide-react';
import { MemoryItem, SkillInfo } from '../types';
import * as api from '../services/api';
import { useToast } from '../context/ToastContext';
import { useI18n } from '../i18n';

interface MemorySkillsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const MemorySkillsModal: React.FC<MemorySkillsModalProps> = ({ isOpen, onClose }) => {
  const { t, formatString } = useI18n();
  const { showToast } = useToast();
  const [activeTab, setActiveTab] = useState<'memory' | 'skills'>('memory');
  const [memories, setMemories] = useState<MemoryItem[]>([]);
  const [skills, setSkills] = useState<SkillInfo[]>([]);
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Memory Add Form State
  const [newMemKey, setNewMemKey] = useState<string>('');
  const [newMemVal, setNewMemVal] = useState<string>('');
  const [newMemCategory, setNewMemCategory] = useState<string>('fact');

  // Skill Editor State
  const [selectedSkillName, setSelectedSkillName] = useState<string>('');
  const [skillContent, setSkillContent] = useState<string>('');
  const [isCreatingSkill, setIsCreatingSkill] = useState<boolean>(false);
  const [newSkillNameInput, setNewSkillNameInput] = useState<string>('');

  useEffect(() => {
    if (isOpen) {
      loadData();
    }
  }, [isOpen]);

  const loadData = async () => {
    try {
      const [memList, skillList] = await Promise.all([
        api.get_memories(),
        api.get_skills(),
      ]);
      setMemories(memList);
      setSkills(skillList);
      if (skillList.length > 0 && !selectedSkillName) {
        setSelectedSkillName(skillList[0].name);
        const content = await api.get_skill_content(skillList[0].name);
        setSkillContent(content);
      }
    } catch (err) {
      console.error('Failed to load memory or skills:', err);
    }
  };

  const handleAddMemory = async () => {
    if (!newMemKey.trim() || !newMemVal.trim()) return;
    try {
      await api.add_memory(newMemKey.trim(), newMemVal.trim(), newMemCategory);
      setNewMemKey('');
      setNewMemVal('');
      showToast(t.toasts.factAdded, 'success');
      await loadData();
    } catch (err: any) {
      showToast(`${t.common.error}: ${err.message || err}`, 'error');
    }
  };

  const handleDeleteMemory = async (id: string) => {
    try {
      await api.delete_memory(id);
      showToast(t.toasts.factDeleted, 'success');
      await loadData();
    } catch (err: any) {
      showToast(`${t.common.error}: ${err.message || err}`, 'error');
    }
  };

  const handleSelectSkill = async (name: string) => {
    setSelectedSkillName(name);
    try {
      const content = await api.get_skill_content(name);
      setSkillContent(content);
    } catch (err) {
      console.error('Failed to read skill:', err);
    }
  };

  const handleSaveSkill = async () => {
    if (!selectedSkillName) return;
    try {
      await api.save_skill(selectedSkillName, skillContent);
      showToast(t.toasts.skillSaved, 'success');
      await loadData();
    } catch (err: any) {
      showToast(`${t.common.error}: ${err.message || err}`, 'error');
    }
  };

  const handleCreateSkill = async () => {
    if (!newSkillNameInput.trim()) return;
    let name = newSkillNameInput.trim().toLowerCase().replace(/\s+/g, '_');
    if (!name.endsWith('.md')) name += '.md';
    try {
      await api.save_skill(name, `# ${name}\n\nSkill instructions...`);
      setIsCreatingSkill(false);
      setNewSkillNameInput('');
      await loadData();
      await handleSelectSkill(name);
      showToast(formatString(t.toasts.skillCreated, { name }), 'success');
    } catch (err: any) {
      showToast(`${t.common.error}: ${err.message || err}`, 'error');
    }
  };

  const handleDeleteSkill = async (name: string) => {
    if (!confirm(`Delete skill ${name}?`)) return;
    try {
      await api.delete_skill(name);
      if (selectedSkillName === name) {
        setSelectedSkillName('');
        setSkillContent('');
      }
      await loadData();
      showToast(formatString(t.toasts.skillDeleted, { name }), 'success');
    } catch (err: any) {
      showToast(`${t.common.error}: ${err.message || err}`, 'error');
    }
  };

  if (!isOpen) return null;

  const filteredMemories = memories.filter((m) => {
    const q = searchQuery.toLowerCase();
    return m.key.toLowerCase().includes(q) || m.value.toLowerCase().includes(q) || m.category.toLowerCase().includes(q);
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-md p-4 font-sans select-none animate-fadeIn">
      <div className="w-full max-w-4xl bento-card rounded-xl border border-[var(--theme-border)] shadow-2xl flex flex-col max-h-[85vh] overflow-hidden text-[var(--theme-text)] bg-[var(--theme-panel)]">
        
        {/* Header Tabs */}
        <div className="px-5 py-3 border-b border-[var(--theme-border)] flex items-center justify-between bg-black/40">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setActiveTab('memory')}
              className={`flex items-center gap-2 text-xs font-medium px-3 py-1.5 rounded-lg transition-all cursor-pointer border ${
                activeTab === 'memory'
                  ? 'bg-white/10 text-[var(--theme-text)] border-[var(--theme-border)] shadow-sm'
                  : 'border-transparent text-[var(--theme-text-muted)] hover:text-[var(--theme-text)] hover:bg-white/5'
              }`}
            >
              <Brain size={14} className="text-[var(--theme-text-muted)]" />
              <span>{t.modals.memorySkills.memoryTab}</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('skills')}
              className={`flex items-center gap-2 text-xs font-medium px-3 py-1.5 rounded-lg transition-all cursor-pointer border ${
                activeTab === 'skills'
                  ? 'bg-white/10 text-[var(--theme-text)] border-[var(--theme-border)] shadow-sm'
                  : 'border-transparent text-[var(--theme-text-muted)] hover:text-[var(--theme-text)] hover:bg-white/5'
              }`}
            >
              <Sparkles size={14} className="text-[var(--theme-text-muted)]" />
              <span>{t.modals.memorySkills.skillsTab}</span>
            </button>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-md text-[var(--theme-text-muted)] hover:text-[var(--theme-text)] hover:bg-white/10 cursor-pointer"
          >
            <X size={15} />
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4 scrollbar-thin">
          
          {/* TAB 1: MEMORY */}
          {activeTab === 'memory' && (
            <div className="space-y-4">
              {/* Add Memory Card */}
              <div className="p-4 rounded-xl bento-card space-y-3">
                <div className="text-xs font-medium text-[var(--theme-text)] flex items-center gap-1.5">
                  <Plus size={13} className="text-[var(--theme-text-muted)]" />
                  <span>{t.modals.memorySkills.addFactTitle}</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <input
                    type="text"
                    value={newMemKey}
                    onChange={(e) => setNewMemKey(e.target.value)}
                    placeholder={t.modals.memorySkills.keyPlaceholder}
                    className="px-3 py-2 rounded-lg bento-card text-xs font-mono text-[var(--theme-text)] focus:outline-none bg-black/40"
                  />
                  <input
                    type="text"
                    value={newMemVal}
                    onChange={(e) => setNewMemVal(e.target.value)}
                    placeholder={t.modals.memorySkills.valPlaceholder}
                    className="px-3 py-2 rounded-lg bento-card text-xs font-mono text-[var(--theme-text)] focus:outline-none bg-black/40"
                  />
                  <div className="flex gap-2">
                    <select
                      value={newMemCategory}
                      onChange={(e) => setNewMemCategory(e.target.value)}
                      className="flex-1 px-3 py-2 rounded-lg bento-card text-xs font-mono bg-black/40 text-[var(--theme-text)] focus:outline-none cursor-pointer"
                    >
                      <option value="fact">Fact</option>
                      <option value="user_preference">User Preference</option>
                      <option value="project_convention">Project Convention</option>
                      <option value="architecture">Architecture</option>
                    </select>
                    <button
                      type="button"
                      onClick={handleAddMemory}
                      className="px-3 py-2 rounded-lg bg-white/10 hover:bg-white/20 border border-[var(--theme-border)] text-xs font-medium text-[var(--theme-text)] cursor-pointer shrink-0 transition-colors"
                    >
                      {t.modals.memorySkills.saveFact}
                    </button>
                  </div>
                </div>
              </div>

              {/* Memory List */}
              <div className="space-y-2">
                <div className="flex justify-between items-center text-xs font-medium text-[var(--theme-text-muted)]">
                  <span>{formatString(t.modals.memorySkills.savedFactsCount, { count: filteredMemories.length })}</span>
                  <div className="relative w-48">
                    <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--theme-text-muted)]" />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder={t.modals.memorySkills.searchPlaceholder}
                      className="w-full pl-7 pr-2 py-1 rounded-lg bento-card text-[11px] text-[var(--theme-text)] focus:outline-none bg-black/40"
                    />
                  </div>
                </div>

                <div className="space-y-1.5 max-h-[350px] overflow-y-auto scrollbar-none">
                  {filteredMemories.map((mem) => (
                    <div
                      key={mem.id}
                      className="p-3 rounded-lg bento-card border border-[var(--theme-border)] flex items-center justify-between gap-3 text-xs"
                    >
                      <div className="space-y-0.5 min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-semibold text-[var(--theme-text)]">{mem.key}</span>
                          <span className="text-[9px] px-1.5 py-0.2 rounded-md bg-white/10 text-[var(--theme-text-muted)] uppercase font-mono">
                            {mem.category}
                          </span>
                        </div>
                        <div className="text-[11px] text-[var(--theme-text-muted)] font-mono truncate">{mem.value}</div>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleDeleteMemory(mem.id)}
                        className="p-1.5 rounded-lg text-[var(--theme-text-muted)] hover:text-[var(--theme-text)] hover:bg-white/10 cursor-pointer transition-colors"
                        title={t.modals.memorySkills.deleteFactTooltip}
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: SKILLS */}
          {activeTab === 'skills' && (
            <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
              {/* Skills Sidebar List */}
              <div className="md:col-span-4 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-[var(--theme-text-muted)] uppercase tracking-wider">
                    {formatString(t.modals.memorySkills.skillsCount, { count: skills.length })}
                  </span>
                  <button
                    type="button"
                    onClick={() => setIsCreatingSkill(true)}
                    className="px-2 py-1 rounded-lg bg-white/10 hover:bg-white/15 border border-[var(--theme-border)] text-xs font-medium text-[var(--theme-text)] flex items-center gap-1 cursor-pointer transition-colors"
                  >
                    <Plus size={12} />
                    <span>{t.modals.memorySkills.createSkillBtn}</span>
                  </button>
                </div>

                {isCreatingSkill && (
                  <div className="p-3 rounded-lg bento-card border border-[var(--theme-border)] space-y-2 animate-fadeIn bg-black/40">
                    <input
                      type="text"
                      value={newSkillNameInput}
                      onChange={(e) => setNewSkillNameInput(e.target.value)}
                      placeholder={t.modals.memorySkills.skillNamePlaceholder}
                      className="w-full px-2.5 py-1.5 rounded-lg bento-card text-xs font-mono text-[var(--theme-text)] focus:outline-none"
                      autoFocus
                    />
                    <div className="flex justify-end gap-1.5">
                      <button
                        type="button"
                        onClick={() => setIsCreatingSkill(false)}
                        className="px-2.5 py-1 rounded-lg bento-card text-xs text-[var(--theme-text-muted)] hover:text-[var(--theme-text)] cursor-pointer"
                      >
                        {t.modals.memorySkills.cancel}
                      </button>
                      <button
                        type="button"
                        onClick={handleCreateSkill}
                        className="px-3 py-1 rounded-lg bg-white/15 hover:bg-white/25 border border-[var(--theme-border)] text-xs font-medium text-[var(--theme-text)] cursor-pointer"
                      >
                        {t.modals.memorySkills.createConfirm}
                      </button>
                    </div>
                  </div>
                )}

                <div className="space-y-1 max-h-[400px] overflow-y-auto pr-1">
                  {skills.map((skill) => {
                    const isSelected = selectedSkillName === skill.name;
                    return (
                      <div
                        key={skill.name}
                        onClick={() => handleSelectSkill(skill.name)}
                        className={`p-2.5 rounded-lg bento-card cursor-pointer transition-all flex items-center justify-between gap-2 border ${
                          isSelected
                            ? 'bg-white/10 border-[var(--theme-border)] text-[var(--theme-text)]'
                            : 'border-transparent text-[var(--theme-text-muted)] hover:text-[var(--theme-text)] hover:bg-white/5'
                        }`}
                      >
                        <span className="font-mono text-xs truncate">{skill.name}</span>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteSkill(skill.name);
                          }}
                          className="p-1 rounded-md text-[var(--theme-text-muted)] hover:text-[var(--theme-text)] hover:bg-white/10 opacity-0 group-hover:opacity-100 cursor-pointer"
                          title={t.modals.memorySkills.deleteSkillTooltip}
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Skill Content Editor */}
              <div className="md:col-span-8 space-y-3">
                {selectedSkillName ? (
                  <div className="p-4 rounded-xl bento-card space-y-2.5">
                    <div className="flex items-center justify-between border-b border-[var(--theme-border)] pb-2">
                      <span className="font-mono text-xs font-semibold text-[var(--theme-text)]">{selectedSkillName}</span>
                      <button
                        type="button"
                        onClick={handleSaveSkill}
                        className="px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 border border-[var(--theme-border)] text-xs font-medium text-[var(--theme-text)] flex items-center gap-1.5 cursor-pointer transition-colors"
                      >
                        <Save size={13} />
                        <span>{t.modals.memorySkills.saveSkillBtn}</span>
                      </button>
                    </div>

                    <textarea
                      value={skillContent}
                      onChange={(e) => setSkillContent(e.target.value)}
                      rows={15}
                      className="w-full p-3 rounded-lg bento-card font-mono text-xs text-[var(--theme-text)] focus:outline-none resize-y bg-black/40"
                    />
                  </div>
                ) : (
                  <div className="p-12 rounded-xl bento-card text-center text-xs text-[var(--theme-text-muted)]">
                    {t.modals.memorySkills.selectSkillPrompt}
                  </div>
                )}
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
};
