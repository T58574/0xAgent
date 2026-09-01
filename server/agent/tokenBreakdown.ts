import { AppConfig, ContextBreakdownReport, TokenBreakdownItem, TokenBreakdownDetailItem } from '../../src/types';
import { loadConfig } from '../config';
import { getActivePersona } from '../personas';
import { getToolsState, loadUnifiedToolsMdContent } from '../toolsConfig';
import { getWorkspace0xAgentMdContext, find0xAgentContext } from '../tools';
import { listSkills, readSkill } from '../skills';
import { loadMemories, getSystemPromptMemoryContext } from '../memory';
import { loadSession } from '../session';
import { estimateMessageTokens } from '../summarizer';
import { buildFullSystemPrompt } from './promptBuilder';

export async function calculateContextBreakdown(
  sessionId?: string | null,
  configOverride?: Partial<AppConfig> | null
): Promise<ContextBreakdownReport> {
  const baseConfig = loadConfig();
  const config: AppConfig = {
    ...baseConfig,
    ...(configOverride || {}),
  };

  const totalBudget = config.local_server?.ctx_size || config.max_tokens || 16384;
  const categories: TokenBreakdownItem[] = [];

  // 1. Tools & XML Specs
  const toolsState = getToolsState();
  const enabledTools = toolsState.tools.filter((t) => t.enabled);
  const toolsMdContent = loadUnifiedToolsMdContent();
  const toolExecutionDirective = `\n\n# TOOL EXECUTION RULES
1. Provide a brief explanation before emitting XML tool calls.
2. ALWAYS use <patch_file> with concise SEARCH/REPLACE blocks (3-8 lines) for existing files. Reserve <write_file> strictly for new files.
3. Close all XML tool tags properly.`;

  const totalToolsText = toolsMdContent + toolExecutionDirective;
  const toolsTokens = estimateMessageTokens(totalToolsText);

  const toolDetails: TokenBreakdownDetailItem[] = toolsState.tools.map((t) => ({
    id: t.id,
    name: t.name,
    tokens: estimateMessageTokens(t.xmlSpec || t.description),
    description: t.description,
    enabled: t.enabled,
    scope: 'Global',
    preview: t.xmlSpec,
  }));

  categories.push({
    id: 'tools',
    name: `Спецификации инструментов (${enabledTools.length} акт.)`,
    category: 'tools',
    tokens: toolsTokens,
    percentage: Number(((toolsTokens / totalBudget) * 100).toFixed(1)),
    shareOfUsed: 0,
    color: '#38bdf8', // Sky
    description: `Concise English XML/JSON tool specifications for ${enabledTools.length} active tools`,
    scope: 'Global',
    contentPreview: toolsMdContent.slice(0, 300) + '...',
    details: toolDetails,
  });

  // 2. Active Skills (Скиллы - только если присутствуют)
  const skills = listSkills();
  if (skills.length > 0) {
    let skillsTotalTokens = 0;
    const skillDetails: TokenBreakdownDetailItem[] = skills.map((s) => {
      let content = '';
      try {
        content = readSkill(s.name);
      } catch {}
      const sTokens = estimateMessageTokens(content || s.description);
      skillsTotalTokens += sTokens;
      return {
        id: s.name,
        name: s.title || s.name,
        tokens: sTokens,
        description: s.description || 'Пользовательская инструкция скилла',
        scope: 'Global',
        preview: content,
      };
    });

    categories.push({
      id: 'skills',
      name: `Скиллы и навыки (${skills.length})`,
      category: 'skills',
      tokens: skillsTotalTokens,
      percentage: Number(((skillsTotalTokens / totalBudget) * 100).toFixed(1)),
      shareOfUsed: 0,
      color: '#06b6d4', // Cyan
      description: `Модульные инструкции и навыки из директории ~/.0xagent/skills/`,
      scope: 'Global',
      contentPreview: skills.map((s) => `• ${s.name}: ${s.description}`).join('\n'),
      details: skillDetails,
    });
  }

  // 3. Persona & SOUL
  const activePersona = getActivePersona();
  const soulTokens = estimateMessageTokens(activePersona.soul);
  categories.push({
    id: 'persona',
    name: `Личность: ${activePersona.metadata.name}`,
    category: 'persona',
    tokens: soulTokens,
    percentage: Number(((soulTokens / totalBudget) * 100).toFixed(1)),
    shareOfUsed: 0,
    color: '#a855f7', // Purple
    description: `Характер, тон общения и директивы поведения (SOUL.md)`,
    scope: 'Global',
    contentPreview: activePersona.soul,
  });

  // 4. User Profile (USER.md)
  const userProfileTokens = estimateMessageTokens(activePersona.user);
  categories.push({
    id: 'user_profile',
    name: `Профиль пользователя (USER.md)`,
    category: 'user_profile',
    tokens: userProfileTokens,
    percentage: Number(((userProfileTokens / totalBudget) * 100).toFixed(1)),
    shareOfUsed: 0,
    color: '#ec4899', // Pink
    description: `Сохраненные предпочтения и настройки пользователя (${activePersona.metadata.user_id})`,
    scope: 'Global',
    contentPreview: activePersona.user,
  });

  // 5. OS & PowerShell Environment Rules
  const envText = `# OPERATING SYSTEM & SHELL ENVIRONMENT
- OS: Windows (${process.platform})
- Shell: PowerShell (powershell.exe)
- Active Working Directory: ${config.workspace_dir || process.cwd()}`;
  const envTokens = estimateMessageTokens(envText);
  categories.push({
    id: 'environment',
    name: `Окружение ОС и PowerShell`,
    category: 'environment',
    tokens: envTokens,
    percentage: Number(((envTokens / totalBudget) * 100).toFixed(1)),
    shareOfUsed: 0,
    color: '#10b981', // Emerald
    description: `Параметры среды Windows, PowerShell и текущей рабочей директории`,
    scope: 'Workspace',
    contentPreview: envText,
  });

  // 6. Planning Mode
  const isPlanning = config.planning_mode !== false;
  const planningText = isPlanning
    ? `Planning Mode Active: Research & Diagnose -> Formulate Plan -> Verification`
    : '';
  const planningTokens = isPlanning ? estimateMessageTokens(planningText) : 0;
  if (isPlanning) {
    categories.push({
      id: 'planning',
      name: `Режим планирования (Planning Mode)`,
      category: 'planning',
      tokens: planningTokens,
      percentage: Number(((planningTokens / totalBudget) * 100).toFixed(1)),
      shareOfUsed: 0,
      color: '#f59e0b', // Amber
      description: `Обязательный регламент исследования кодовой базы перед патчами`,
      scope: 'Global',
      contentPreview: planningText,
    });
  }

  // 7. Workspace Rules (.0xagent.md / GEMINI.md)
  const workspaceMd = getWorkspace0xAgentMdContext(config.workspace_dir);
  const foundLocal = find0xAgentContext(config.workspace_dir || process.cwd());
  const workspaceTokens = estimateMessageTokens(workspaceMd);
  categories.push({
    id: 'workspace_rules',
    name: foundLocal ? `Правила проекта (${foundLocal.filePath.split(/[\\/]/).pop()})` : `Правила проекта (.0xagent.md)`,
    category: 'workspace_rules',
    tokens: workspaceTokens,
    percentage: Number(((workspaceTokens / totalBudget) * 100).toFixed(1)),
    shareOfUsed: 0,
    color: '#6366f1', // Indigo
    description: foundLocal ? `Контекст проекта из ${foundLocal.filePath}` : 'Файл .0xagent.md или GEMINI.md в корне проекта не найден',
    scope: 'Workspace',
    contentPreview: workspaceMd || 'Локальный контекстный файл не загружен',
  });

  // 8. Long-Term Memory (memory.db)
  const memories = loadMemories();
  const memoryDetails: TokenBreakdownDetailItem[] = memories.map((m) => {
    const itemTokens = estimateMessageTokens(`- [${m.category.toUpperCase()}] ${m.key}: ${m.value}`);
    return {
      id: m.id,
      name: m.key,
      tokens: itemTokens,
      description: `[${m.category.toUpperCase()}] ${m.value}`,
      scope: m.scope === 'project' ? 'Workspace' : 'Global',
      preview: m.value,
    };
  });

  const memoryTokens = memoryDetails.reduce((sum, d) => sum + d.tokens, 0);
  const memoryMd = getSystemPromptMemoryContext();

  categories.push({
    id: 'memory',
    name: `Долгосрочная память (${memories.length} фактов)`,
    category: 'memory',
    tokens: memoryTokens,
    percentage: Number(((memoryTokens / totalBudget) * 100).toFixed(1)),
    shareOfUsed: 0,
    color: '#84cc16', // Lime
    description: `База постоянных фактов и предпочтений из SQLite WAL (~/.0xagent/memory.db)`,
    scope: 'Global',
    contentPreview: memoryMd || memories.map(m => `- [${m.category.toUpperCase()}] ${m.key}: ${m.value}`).join('\n'),
    details: memoryDetails,
  });

  // 9. Session Chat Messages (if session exists)
  let chatTokens = 0;
  let messageCount = 0;
  if (sessionId) {
    try {
      const session = await loadSession(sessionId);
      messageCount = session.messages.length;
      for (const msg of session.messages) {
        chatTokens += estimateMessageTokens(msg.content);
        if (Array.isArray(msg.images)) {
          chatTokens += msg.images.length * 576;
        }
      }
    } catch {}
  }

  if (chatTokens > 0 || messageCount > 0) {
    categories.push({
      id: 'chat_history',
      name: `История сообщений диалога (${messageCount} сообщ.)`,
      category: 'chat_history',
      tokens: chatTokens,
      percentage: Number(((chatTokens / totalBudget) * 100).toFixed(1)),
      shareOfUsed: 0,
      color: '#f43f5e', // Rose
      description: `Реплики пользователя и ответы ассистента в текущем открытом чате`,
      scope: 'Workspace',
    });
  }

  // Calculate totals
  const systemPromptTokens = estimateMessageTokens(buildFullSystemPrompt(config));
  const totalUsed = categories.reduce((sum, c) => sum + c.tokens, 0);
  const availableTokens = Math.max(0, totalBudget - totalUsed);
  const availablePercentage = Number(((availableTokens / totalBudget) * 100).toFixed(1));
  const usedPercentage = Number(((totalUsed / totalBudget) * 100).toFixed(1));

  // Compute share of used tokens for each category
  for (const cat of categories) {
    cat.shareOfUsed = totalUsed > 0 ? Number(((cat.tokens / totalUsed) * 100).toFixed(1)) : 0;
  }

  return {
    totalBudget,
    totalUsed,
    availableTokens,
    availablePercentage,
    usedPercentage,
    systemPromptTokens,
    chatMessagesTokens: chatTokens,
    categories,
    modelName: config.model_name || 'local:qwen2.5-coder-32b.gguf',
    sessionId: sessionId || null,
  };
}
