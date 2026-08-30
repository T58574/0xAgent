import { addOrUpdateMemory, saveEpisode } from '../memory';
import { proposePersonaChange } from '../personas';
import { resolveProjectForWorkspace } from '../projectService';
import { ChatMessage } from '../../src/types';

export interface ReflectionInput {
  sessionId: string;
  messages: ChatMessage[];
  workspaceDir?: string | null;
  activePersonaId?: string;
  userExplicitFeedback?: string;
}

export interface ReflectionResult {
  episodeId?: string;
  extractedFactsCount: number;
  promotedMemories: string[];
  proposalCreated: boolean;
  proposalId?: string;
}

/**
 * Autonomous Reflection Pipeline:
 * Triggered asynchronously after a multi-turn task concludes to summarize progress,
 * distill salient insights into memory, and propose persona adjustments if needed.
 */
export async function executeAutonomousReflection(input: ReflectionInput): Promise<ReflectionResult> {
  const { sessionId, messages, workspaceDir, activePersonaId = 'default' } = input;
  if (!messages || messages.length < 2) {
    return { extractedFactsCount: 0, promotedMemories: [], proposalCreated: false };
  }

  let projectId: string | null = null;
  if (workspaceDir) {
    try {
      const proj = resolveProjectForWorkspace(workspaceDir);
      projectId = proj.id;
    } catch {}
  }

  const promotedMemories: string[] = [];
  let episodeId: string | undefined;
  let proposalCreated = false;
  let proposalId: string | undefined;

  // 1. Synthesize Episode Summary
  const userMessages = messages.filter((m) => m.role === 'user');
  const assistantMessages = messages.filter((m) => m.role === 'assistant');
  const initialTask = userMessages[0]?.content || 'Completed conversation task';
  const finalSummary = assistantMessages[assistantMessages.length - 1]?.content || 'Task completed successfully.';

  const taskTitle = typeof initialTask === 'string'
    ? initialTask.slice(0, 60).replace(/[\r\n]+/g, ' ')
    : 'Conversation Task';

  const sanitizedSummary = typeof finalSummary === 'string'
    ? finalSummary.slice(0, 250).replace(/[\r\n]+/g, ' ')
    : 'Session completed.';

  try {
    const ep = saveEpisode({
      sessionId,
      title: taskTitle,
      summary: sanitizedSummary,
      subjectId: 'user_default',
    });
    episodeId = ep.id;
  } catch (err) {
    console.warn('[reflection] Failed to insert episode record:', err);
  }

  // 2. Distill Salient Learnings from Dialogue
  for (const m of userMessages) {
    const text = typeof m.content === 'string' ? m.content : '';

    // Check for explicit project-level convention cues
    const projMatch = text.match(/(?:в этом проекте|для этого репо|всегда используй|не используй)\s+([^.!?\n]+)/i);
    if (projMatch && projMatch[1] && projectId) {
      const factVal = projMatch[1].trim();
      const factKey = `convention_${factVal.slice(0, 20).toLowerCase().replace(/[^a-z0-9а-яё]+/gi, '_')}`;
      try {
        addOrUpdateMemory(factKey, factVal, 'project_convention', {
          scope: 'project',
          projectId,
          subjectId: 'user_default',
          confidence: 0.9,
          actorScope: activePersonaId,
          isExplicit: true,
        });
        promotedMemories.push(`[PROJECT] ${factKey}`);
      } catch {}
    }

    // Check for explicit user preference cues
    const prefMatch = text.match(/(?:мне нравится|я предпочитаю|пиши на|мой язык|отвечай)\s+([^.!?\n]+)/i);
    if (prefMatch && prefMatch[1]) {
      const prefVal = prefMatch[1].trim();
      const prefKey = `pref_${prefVal.slice(0, 20).toLowerCase().replace(/[^a-z0-9а-яё]+/gi, '_')}`;
      try {
        addOrUpdateMemory(prefKey, prefVal, 'preference', {
          scope: 'user',
          subjectId: 'user_default',
          confidence: 0.95,
          actorScope: activePersonaId,
          isExplicit: true,
        });
        promotedMemories.push(`[USER] ${prefKey}`);
      } catch {}
    }

    // Check for Persona Evolution cues (e.g. "будь строже", "добавь правило для личности")
    const personaRuleMatch = text.match(/(?:добавь в свою личность|запомни как правило поведения|измени характер)\s*[:—]\s*([^.!?\n]+)/i);
    if (personaRuleMatch && personaRuleMatch[1]) {
      const directive = personaRuleMatch[1].trim();
      const propRes = proposePersonaChange({
        persona_id: activePersonaId,
        target_file: 'SOUL.md',
        target_section: 'custom_guidelines',
        operation: 'append',
        patch_payload: {
          section: 'custom_guidelines',
          content: `- ${directive}`,
        },
        rationale: `Autonomous reflection from session ${sessionId}: user requested behavioral adjustment`,
        source_type: 'agent',
        source_session_id: sessionId,
      });

      if (propRes.ok && propRes.proposal) {
        proposalCreated = true;
        proposalId = propRes.proposal.id;
      }
    }
  }

  return {
    episodeId,
    extractedFactsCount: promotedMemories.length,
    promotedMemories,
    proposalCreated,
    proposalId,
  };
}
