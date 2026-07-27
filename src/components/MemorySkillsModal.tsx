import React, { useState, useEffect } from 'react';
import { Brain, Sparkles, X, Plus, Trash2, Save, Search } from 'lucide-react';
import { MemoryItem, SkillInfo } from '../types';
import * as api from '../services/api';
import { useToast } from '../context/ToastContext';

interface MemorySkillsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const MemorySkillsModal: React.FC<MemorySkillsModalProps> = ({ isOpen, onClose }) => {
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
      showToast('Факт успешно сохранен в память!', 'success');
      await loadData();
    } catch (err: any) {
      showToast(`Ошибка добавления памяти: ${err.message || err}`, 'error');
    }
  };

  const handleDeleteMemory = async (id: string) => {
    try {
      await api.delete_memory(id);
      showToast('Факт удален из памяти.', 'success');
      await loadData();
    } catch (err: any) {
      showToast(`Ошибка удаления: ${err.message || err}`, 'error');
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
      showToast('Скилл сохранен!', 'success');
      await loadData();
    } catch (err: any) {
      showToast(`Ошибка сохранения: ${err.message || err}`, 'error');
    }
  };

  const handleCreateSkill = async () => {
    if (!newSkillNameInput.trim()) return;
    let name = newSkillNameInput.trim().toLowerCase().replace(/\s+/g, '_');
    try {
      const template = `# ${name.replace(/_/g, ' ')} Skill\nDescription: Описание скилла...\n\n## Instructions\n1. Шаги...`;
      await api.save_skill(name, template);
      setIsCreatingSkill(false);
      setNewSkillNameInput('');
      showToast(`Скилл ${name} создан!`, 'success');
      await loadData();
      await handleSelectSkill(name);
    } catch (err: any) {
      showToast(`Ошибка создания скилла: ${err.message || err}`, 'error');
    }
  };

  const handleDeleteSkill = async (name: string) => {
    if (!confirm(`Удалить скилл "${name}"?`)) return;
    try {
      await api.delete_skill(name);
      showToast(`Скилл ${name} удален.`, 'success');
      await loadData();
    } catch (err: any) {
      showToast(`Ошибка удаления: ${err.message || err}`, 'error');
    }
  };


  if (!isOpen) return null;

  const filteredMemories = memories.filter((m) => {
    const q = searchQuery.toLowerCase();
    return m.key.toLowerCase().includes(q) || m.value.toLowerCase().includes(q) || m.category.toLowerCase().includes(q);
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 font-sans select-none animate-fadeIn">
      <div className="w-full max-w-4xl glass-panel rounded-lg border border-white/15 shadow-2xl flex flex-col max-h-[85vh] overflow-hidden text-slate-100">
        
        {/* Header Tabs */}
        <div className="px-4 py-3 border-b border-white/10 flex items-center justify-between bg-slate-900/60">
          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={() => setActiveTab('memory')}
              className={`flex items-center gap-2 text-xs font-semibold px-3 py-1.5 rounded transition-all cursor-pointer ${
                activeTab === 'memory'
                  ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Brain size={15} />
              <span>Долгосрочная Память (~/.0xagent/memory.json)</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('skills')}
              className={`flex items-center gap-2 text-xs font-semibold px-3 py-1.5 rounded transition-all cursor-pointer ${
                activeTab === 'skills'
                  ? 'bg-purple-500/20 text-purple-400 border border-purple-500/40'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Sparkles size={15} />
              <span>Реестр Скиллов (~/.0xagent/skills/)</span>
            </button>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded text-slate-400 hover:text-white hover:bg-white/10 cursor-pointer"
          >
            <X size={15} />
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          
          {/* TAB 1: MEMORY */}
          {activeTab === 'memory' && (
            <div className="space-y-4">
              {/* Add Memory Card */}
              <div className="p-3.5 rounded bg-slate-900/60 border border-white/10 space-y-3">
                <div className="text-xs font-semibold text-slate-200 flex items-center gap-1.5">
                  <Plus size={13} className="text-emerald-400" />
                  <span>Запомнить новый факт в память</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <input
                    type="text"
                    value={newMemKey}
                    onChange={(e) => setNewMemKey(e.target.value)}
                    placeholder="Ключ (e.g. preferred_db)"
                    className="px-2.5 py-1.5 rounded flat-input text-xs font-mono"
                  />
                  <input
                    type="text"
                    value={newMemVal}
                    onChange={(e) => setNewMemVal(e.target.value)}
                    placeholder="Значение (e.g. PostgreSQL with Prisma)"
                    className="px-2.5 py-1.5 rounded flat-input text-xs font-mono"
                  />
                  <div className="flex gap-2">
                    <select
                      value={newMemCategory}
                      onChange={(e) => setNewMemCategory(e.target.value)}
                      className="flex-1 px-2 py-1.5 rounded flat-input text-xs font-mono bg-slate-900"
                    >
                      <option value="fact">Fact</option>
                      <option value="user_preference">User Preference</option>
                      <option value="project_convention">Project Convention</option>
                      <option value="architecture">Architecture</option>
                    </select>
                    <button
                      type="button"
                      onClick={handleAddMemory}
                      className="flat-btn px-3 py-1.5 rounded text-xs font-medium text-emerald-400 border-emerald-500/40 hover:bg-emerald-500/10 cursor-pointer shrink-0"
                    >
                      Сохранить
                    </button>
                  </div>
                </div>
              </div>

              {/* Memory List */}
              <div className="space-y-2">
                <div className="flex justify-between items-center text-xs font-semibold text-slate-300">
                  <span>Сохраненные факты ({filteredMemories.length})</span>
                  <div className="relative w-48">
                    <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500" />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Поиск..."
                      className="w-full pl-7 pr-2 py-1 rounded flat-input text-[11px]"
                    />
                  </div>
                </div>

                <div className="space-y-2 max-h-[350px] overflow-y-auto scrollbar-none">
                  {filteredMemories.map((mem) => (
                    <div
                      key={mem.id}
                      className="p-3 rounded border border-white/10 bg-slate-900/40 flex items-center justify-between gap-3 text-xs"
                    >
                      <div className="space-y-0.5 min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-emerald-300">{mem.key}</span>
                          <span className="text-[10px] px-1.5 py-0.2 rounded bg-slate-800 text-slate-300 border border-white/10 font-mono">
                            {mem.category}
                          </span>
                        </div>
                        <div className="text-slate-200 font-mono text-[11px] break-all">{mem.value}</div>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleDeleteMemory(mem.id)}
                        className="text-rose-400 hover:text-rose-300 p-1.5 rounded hover:bg-rose-500/10 cursor-pointer"
                        title="Удалить факт"
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
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 min-h-[400px]">
              {/* Left Skills List */}
              <div className="p-3 rounded bg-slate-900/60 border border-white/10 flex flex-col justify-between space-y-3">
                <div className="space-y-2 flex-1 flex flex-col min-h-0">
                  <div className="flex justify-between items-center pb-2 border-b border-white/10">
                    <span className="text-xs font-semibold text-slate-300">Доступные Скиллы ({skills.length})</span>
                    <button
                      type="button"
                      onClick={() => setIsCreatingSkill(!isCreatingSkill)}
                      className="flat-btn px-2 py-1 rounded text-[11px] font-medium text-purple-400 border-purple-500/40 hover:bg-purple-500/10 flex items-center gap-1"
                    >
                      <Plus size={11} />
                      <span>Создать</span>
                    </button>
                  </div>

                  {isCreatingSkill && (
                    <div className="p-2 rounded bg-slate-900 border border-white/10 space-y-2">
                      <input
                        type="text"
                        value={newSkillNameInput}
                        onChange={(e) => setNewSkillNameInput(e.target.value)}
                        placeholder="skill_name.md"
                        className="w-full px-2 py-1 rounded flat-input text-xs font-mono"
                      />
                      <div className="flex justify-end gap-1">
                        <button
                          type="button"
                          onClick={() => setIsCreatingSkill(false)}
                          className="px-2 py-0.5 rounded text-[10px] text-slate-400"
                        >
                          Отмена
                        </button>
                        <button
                          type="button"
                          onClick={handleCreateSkill}
                          className="flat-btn px-2 py-0.5 rounded text-[10px] text-purple-400 border-purple-500/40"
                        >
                          Сохранить
                        </button>
                      </div>
                    </div>
                  )}

                  <div className="space-y-1 overflow-y-auto flex-1 scrollbar-none pr-1">
                    {skills.map((sk) => {
                      const isSel = sk.name === selectedSkillName;
                      return (
                        <div
                          key={sk.name}
                          onClick={() => handleSelectSkill(sk.name)}
                          className={`p-2 rounded border text-xs cursor-pointer transition-all flex items-center justify-between gap-2 ${
                            isSel
                              ? 'border-purple-500/50 bg-purple-500/10 text-white font-semibold'
                              : 'border-white/5 bg-slate-900/30 text-slate-300 hover:bg-white/[0.03]'
                          }`}
                        >
                          <div className="min-w-0 flex-1">
                            <div className="font-mono text-xs truncate flex items-center gap-1.5">
                              <Sparkles size={12} className="text-purple-400" />
                              <span>{sk.name}</span>
                            </div>
                            <div className="text-[10px] text-slate-400 truncate mt-0.5">{sk.description}</div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Right Skill Editor */}
              <div className="md:col-span-2 p-3.5 rounded bg-slate-900/60 border border-white/10 flex flex-col justify-between space-y-3">
                <div className="flex items-center justify-between pb-2 border-b border-white/10">
                  <span className="font-mono font-bold text-xs text-slate-200">{selectedSkillName}.md</span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleDeleteSkill(selectedSkillName)}
                      className="flat-btn p-1.5 rounded text-rose-400 border-rose-500/30 hover:bg-rose-500/10 cursor-pointer"
                    >
                      <Trash2 size={13} />
                    </button>
                    <button
                      type="button"
                      onClick={handleSaveSkill}
                      className="flat-btn px-3 py-1 rounded text-xs font-medium text-purple-400 border-purple-500/40 hover:bg-purple-500/10 cursor-pointer flex items-center gap-1.5"
                    >
                      <Save size={12} />
                      <span>Сохранить скилл</span>
                    </button>
                  </div>
                </div>

                <textarea
                  value={skillContent}
                  onChange={(e) => setSkillContent(e.target.value)}
                  className="w-full flex-1 p-3 rounded flat-input font-mono text-xs text-slate-100 focus:outline-none min-h-[300px] resize-none"
                />
              </div>
            </div>
          )}

        </div>

        {/* Footer */}
        <div className="px-4 py-2.5 bg-slate-900/60 border-t border-white/10 flex items-center justify-between text-xs text-slate-400">
          <span>0xAgent Memory & Skills Subsystem</span>
          <button
            type="button"
            onClick={onClose}
            className="flat-btn px-3 py-1 rounded text-xs font-medium text-slate-300 hover:text-white"
          >
            Закрыть
          </button>
        </div>

      </div>
    </div>
  );
};
