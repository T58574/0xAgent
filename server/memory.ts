import {
  CanonicalMemory,
  Episode,
  PersonaRelationship,
  MemoryAuditEntry,
  MemoryCategory,
  MemoryStatus,
  MemoryScope,
  MemoryItem,
} from '../src/types';
import { getMemoryDb } from './memoryDb';
import { resolveProjectForWorkspace } from './projectService';
import { inferPromptMode, allocateScopedMemories } from './budgetManager';
import {
  DEFAULT_SUBJECT_ID,
  normalizeCategory,
  AddMemoryOptions,
  addOrUpdateMemory,
  getUserMemories,
  getProjectMemories,
  getPersonaMemories,
  loadMemories,
  getCanonicalMemories,
  deleteMemory,
  queryMemories,
  getCandidateMemories,
  resolveConflict,
} from './memoryStore';
import {
  saveEpisode,
  searchEpisodesFts,
  getPersonaRelationship,
  upsertPersonaRelationship,
} from './memoryEpisodes';

export {
  getMemoryDb,
  normalizeCategory,
  addOrUpdateMemory,
  getUserMemories,
  getProjectMemories,
  getPersonaMemories,
  loadMemories,
  getCanonicalMemories,
  deleteMemory,
  queryMemories,
  getCandidateMemories,
  resolveConflict,
  saveEpisode,
  searchEpisodesFts,
  getPersonaRelationship,
  upsertPersonaRelationship,
};

export type {
  AddMemoryOptions,
  CanonicalMemory,
  Episode,
  PersonaRelationship,
  MemoryAuditEntry,
  MemoryCategory,
  MemoryStatus,
  MemoryScope,
  MemoryItem,
};

// ============================================================================
// DETERMINISTIC MEMORY ROUTER & DYNAMIC TOKEN BUDGET (0..400 Tokens)
// ============================================================================

export interface MemoryRoutingResult {
  injectedFacts: CanonicalMemory[];
  injectedEpisodes: Episode[];
  relationship: PersonaRelationship;
  tokenCountEstimate: number;
}

export function routeAndRankMemories(options: {
  userQuery?: string;
  activePersonaId?: string;
  subjectId?: string;
  projectId?: string | null;
  workspaceDir?: string | null;
  maxTokenBudget?: number;
}): MemoryRoutingResult {
  const subjectId = options.subjectId || DEFAULT_SUBJECT_ID;
  const personaId = options.activePersonaId || 'default';
  const query = (options.userQuery || '').trim().toLowerCase();
  const maxTokens = options.maxTokenBudget || 400;

  let resolvedProjectId = options.projectId;
  if (!resolvedProjectId && options.workspaceDir) {
    try {
      const proj = resolveProjectForWorkspace(options.workspaceDir);
      resolvedProjectId = proj.id;
    } catch {}
  }

  const relationship = getPersonaRelationship(personaId, subjectId);
  const promptMode = inferPromptMode(query);

  // Invariant 1: Casual dialogue / empty greetings -> 0 memories injected
  const isCasual = promptMode === 'small_talk';

  if (isCasual) {
    return {
      injectedFacts: [],
      injectedEpisodes: [],
      relationship,
      tokenCountEstimate: estimateTokens(relationship.relationship_summary || ''),
    };
  }

  const db = getMemoryDb();
  let allActiveFacts: CanonicalMemory[] = [];

  if (resolvedProjectId) {
    allActiveFacts = db.prepare(`
      SELECT * FROM canonical_memories 
      WHERE (subject_id = ? OR (scope = 'project' AND project_id = ?)) AND status = 'active'
      ORDER BY importance DESC, updated_at DESC
    `).all(subjectId, resolvedProjectId) as unknown as CanonicalMemory[];
  } else {
    allActiveFacts = db.prepare(`
      SELECT * FROM canonical_memories 
      WHERE subject_id = ? AND status = 'active'
      ORDER BY importance DESC, updated_at DESC
    `).all(subjectId) as unknown as CanonicalMemory[];
  }

  // Scoring facts
  const scoredFacts = allActiveFacts.map((f) => {
    let score = f.importance * 1.5 + f.confidence * 2.0;
    if (f.scope === 'project') {
      score += 2.0; // Project context boost
    }
    const keyLower = f.key.toLowerCase();
    const valLower = f.value.toLowerCase();

    // Query lexical match
    const keyWords = keyLower.split(/[_\s-]+/);
    if (query.includes(keyLower) || keyLower.includes(query) || keyWords.some((w) => w.length >= 2 && query.includes(w))) {
      score += 5.0;
    }
    if (query.includes(valLower)) {
      score += 3.0;
    }
    // High priority domains / concepts
    if (
      (query.includes('gpu') || query.includes('видеокарт') || query.includes('железо') || query.includes('card')) &&
      (f.domain === 'hardware' || f.key.includes('gpu') || f.value.toLowerCase().includes('radeon') || f.value.toLowerCase().includes('nvidia'))
    ) {
      score += 6.0;
    }
    if (
      (query.includes('язык') || query.includes('language') || query.includes('русск') || query.includes('english')) &&
      (f.key.includes('language') || f.value.toLowerCase().includes('russian') || f.value.toLowerCase().includes('english'))
    ) {
      score += 6.0;
    }

    return { fact: f, score };
  });

  scoredFacts.sort((a, b) => b.score - a.score);

  // Episodic search if query triggers past recall
  let matchedEpisodes: Episode[] = [];
  const isEpisodicQuery =
    /помнишь|вчера|прошлый раз|когда мы|рассказывал|обсуждали|поездк|remember|last time|discussed/i.test(query);

  if (isEpisodicQuery) {
    matchedEpisodes = searchEpisodesFts(query, 3, subjectId);
  }

  // Dynamic Token Budgeting via BudgetManager
  const factsList = scoredFacts.map((s) => s.fact);
  const plan = allocateScopedMemories(factsList, matchedEpisodes, promptMode, { total_max: maxTokens });

  return {
    injectedFacts: plan.allocatedFacts,
    injectedEpisodes: plan.allocatedEpisodes,
    relationship,
    tokenCountEstimate: plan.totalEstimatedTokens,
  };
}

export function getSystemPromptMemoryContext(activePersonaId: string = 'default', userQuery?: string, workspaceDir?: string): string {
  const result = routeAndRankMemories({ activePersonaId, userQuery, workspaceDir });
  const lines: string[] = [];

  // Persona Relationship Context (if defined and non-trivial)
  if (result.relationship.relationship_summary && result.relationship.interaction_count > 0) {
    lines.push(`## Relationship Dynamics with User:`);
    lines.push(`- Dynamics: ${result.relationship.relationship_summary}`);
    if (result.relationship.preferred_address) {
      lines.push(`- Preferred Address: ${result.relationship.preferred_address}`);
    }
    if (result.relationship.shared_references && result.relationship.shared_references.length > 0) {
      lines.push(`- Shared References: ${result.relationship.shared_references.join(', ')}`);
    }
  }

  // Canonical User Memories
  if (result.injectedFacts.length > 0) {
    lines.push(`## Known Facts & Preferences:`);
    for (const f of result.injectedFacts) {
      lines.push(`- [${f.category.toUpperCase()}] ${f.key}: ${f.value}`);
    }
  }

  // Relevant Episodes
  if (result.injectedEpisodes.length > 0) {
    lines.push(`## Relevant Past Episodes:`);
    for (const ep of result.injectedEpisodes) {
      lines.push(`- [${ep.title}]: ${ep.summary}`);
    }
  }

  if (lines.length === 0) {
    return '';
  }

  return `\n\n# Dynamic Persona & User Memory View\n${lines.join('\n')}`;
}

function estimateTokens(text: string): number {
  return Math.ceil(text.length / 3.5);
}
