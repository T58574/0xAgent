import { PromptMode, PromptTokenBudget, CanonicalMemory, Episode } from '../src/types';

export const PROMPT_MODE_BUDGETS: Record<PromptMode, PromptTokenBudget> = {
  small_talk: {
    core_max: 30,
    user_max: 50,
    project_max: 0,
    persona_max: 30,
    episodic_max: 0,
    total_max: 110,
  },
  chat_assist: {
    core_max: 50,
    user_max: 100,
    project_max: 50,
    persona_max: 50,
    episodic_max: 50,
    total_max: 300,
  },
  coding_task: {
    core_max: 60,
    user_max: 100,
    project_max: 180,
    persona_max: 60,
    episodic_max: 80,
    total_max: 480,
  },
  debugging: {
    core_max: 60,
    user_max: 80,
    project_max: 200,
    persona_max: 60,
    episodic_max: 120,
    total_max: 520,
  },
  architecture_review: {
    core_max: 80,
    user_max: 120,
    project_max: 250,
    persona_max: 80,
    episodic_max: 150,
    total_max: 680,
  },
};

/**
 * Infer the optimal prompt mode from user query and context intent.
 */
export function inferPromptMode(query?: string, explicitMode?: PromptMode): PromptMode {
  if (explicitMode && PROMPT_MODE_BUDGETS[explicitMode]) {
    return explicitMode;
  }

  const q = (query || '').trim().toLowerCase();
  if (
    !q ||
    /^(привет|хай|здравствуй|hello|hi|hey|ok|ок|спасибо|thanks|ясно|понял|как дела|how are you|добрый день)[\s!.,?]*$/i.test(q) ||
    /^(привет|hello|hi)[\s!.,?]+(?:как дела|how are you)[\s!.,?]*$/i.test(q)
  ) {
    return 'small_talk';
  }

  if (/баг|ошибк|error|exception|fail|crash|debug|стектрейс|traceback|undefined|is not a function/i.test(q)) {
    return 'debugging';
  }

  if (/архитектур|дизайн|рефакторинг|схема|architecture|structure|module|database|contract|контракт/i.test(q)) {
    return 'architecture_review';
  }

  if (
    /напиши|создай|реализуй|функци|компонент|тест|код|правил|соглашени|проект|script|implement|write|create|component|test|rule|convention/i.test(
      q
    )
  ) {
    return 'coding_task';
  }

  return 'chat_assist';
}

export function estimateTokenCount(text: string): number {
  return Math.ceil(text.length / 3.5);
}

export interface ScopedBudgetPlan {
  mode: PromptMode;
  budget: PromptTokenBudget;
  allocatedFacts: CanonicalMemory[];
  allocatedEpisodes: Episode[];
  totalEstimatedTokens: number;
  droppedCount: number;
}

/**
 * Allocate memories across scopes respecting hard budget boundaries.
 */
export function allocateScopedMemories(
  facts: CanonicalMemory[],
  episodes: Episode[],
  mode: PromptMode = 'chat_assist',
  customBudget?: Partial<PromptTokenBudget>
): ScopedBudgetPlan {
  const budget: PromptTokenBudget = {
    ...PROMPT_MODE_BUDGETS[mode],
    ...(customBudget || {}),
  };

  const allocatedFacts: CanonicalMemory[] = [];
  const allocatedEpisodes: Episode[] = [];
  let userTokens = 0;
  let projectTokens = 0;
  let personaTokens = 0;
  let episodicTokens = 0;
  let totalTokens = 0;
  let droppedCount = 0;

  const userMax = budget.user_max ?? 100;
  const projectMax = budget.project_max ?? 150;
  const personaMax = budget.persona_max ?? 50;
  const episodicMax = budget.episodic_max ?? 50;
  const totalMax = budget.total_max ?? 400;

  // 1. Allocate facts by scope
  for (const f of facts) {
    const text = `- [${(f.scope || f.category).toUpperCase()}] ${f.key}: ${f.value}`;
    const tokens = estimateTokenCount(text);

    let canFit = totalTokens + tokens <= totalMax;

    if (f.scope === 'user') {
      canFit = canFit && userTokens + tokens <= userMax;
      if (canFit) {
        userTokens += tokens;
        totalTokens += tokens;
        allocatedFacts.push(f);
      } else {
        droppedCount++;
      }
    } else if (f.scope === 'project') {
      canFit = canFit && projectTokens + tokens <= projectMax;
      if (canFit) {
        projectTokens += tokens;
        totalTokens += tokens;
        allocatedFacts.push(f);
      } else {
        droppedCount++;
      }
    } else if (f.scope === 'persona') {
      canFit = canFit && personaTokens + tokens <= personaMax;
      if (canFit) {
        personaTokens += tokens;
        totalTokens += tokens;
        allocatedFacts.push(f);
      } else {
        droppedCount++;
      }
    } else {
      if (canFit && userTokens + tokens <= userMax) {
        userTokens += tokens;
        totalTokens += tokens;
        allocatedFacts.push(f);
      } else {
        droppedCount++;
      }
    }
  }

  // 2. Allocate episodic memories
  for (const ep of episodes) {
    const text = `- [EPISODE ${ep.title}]: ${ep.summary}`;
    const tokens = estimateTokenCount(text);

    if (episodicTokens + tokens <= episodicMax && totalTokens + tokens <= totalMax) {
      episodicTokens += tokens;
      totalTokens += tokens;
      allocatedEpisodes.push(ep);
    } else {
      droppedCount++;
    }
  }

  return {
    mode,
    budget,
    allocatedFacts,
    allocatedEpisodes,
    totalEstimatedTokens: totalTokens,
    droppedCount,
  };
}
