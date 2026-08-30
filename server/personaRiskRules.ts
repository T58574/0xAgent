import { PersonaFile, ProposalOperation, RiskLevel } from '../src/types';

export interface PersonaRiskRule {
  id: string;
  targetFile?: PersonaFile | '*';
  targetSection?: string | '*';
  operation?: ProposalOperation | '*';
  riskLevel: RiskLevel;
  requiresApproval: boolean;
  rationale: string;
}

export const DECLARATIVE_RISK_RULES: PersonaRiskRule[] = [
  // 1. Critical Rules: Direct safety / core directive modifications
  {
    id: 'rule_core_policy',
    targetFile: 'CORE.md',
    operation: '*',
    riskLevel: 'critical',
    requiresApproval: true,
    rationale: 'CORE.md defines global system invariants and cannot be altered by agents.',
  },
  {
    id: 'rule_soul_delete',
    targetFile: 'SOUL.md',
    operation: 'delete_section',
    riskLevel: 'critical',
    requiresApproval: true,
    rationale: 'Deleting sections from SOUL.md risks breaking agent persona integrity.',
  },
  {
    id: 'rule_protected_section_modify',
    targetSection: 'safety',
    operation: '*',
    riskLevel: 'critical',
    requiresApproval: true,
    rationale: 'Protected safety sections are immutable by automated proposals.',
  },

  // 2. High Risk Rules: Soul replacements and Pinned preferences
  {
    id: 'rule_soul_replace',
    targetFile: 'SOUL.md',
    operation: 'replace_section',
    riskLevel: 'high',
    requiresApproval: true,
    rationale: 'Replacing SOUL.md sections drastically shifts persona character.',
  },
  {
    id: 'rule_soul_append',
    targetFile: 'SOUL.md',
    operation: 'append',
    riskLevel: 'high',
    requiresApproval: true,
    rationale: 'Adding new core directives alters agent behavior.',
  },
  {
    id: 'rule_user_pinned_modify',
    targetFile: 'USER_PINNED.md',
    operation: '*',
    riskLevel: 'high',
    requiresApproval: true,
    rationale: 'User pinned rules are explicit constraints set by the user.',
  },

  // 3. Medium Risk Rules: Tools rules
  {
    id: 'rule_tools_replace',
    targetFile: 'TOOLS.md',
    operation: 'replace_section',
    riskLevel: 'high',
    requiresApproval: true,
    rationale: 'Replacing tool calling instructions may alter tool execution safety.',
  },
  {
    id: 'rule_tools_append',
    targetFile: 'TOOLS.md',
    operation: 'append',
    riskLevel: 'medium',
    requiresApproval: true,
    rationale: 'Appending tool usage notes is standard self-improvement.',
  },

  // 4. Low Risk Rules: General profile additions
  {
    id: 'rule_user_append',
    targetFile: 'USER.md',
    operation: 'append',
    riskLevel: 'low',
    requiresApproval: false,
    rationale: 'Appending learned user preferences is low risk.',
  },
];

/**
 * Evaluate proposal risk using declarative rules.
 */
export function evaluateProposalRisk(
  targetFile: PersonaFile,
  targetSection?: string | null,
  operation: ProposalOperation = 'append'
): { riskLevel: RiskLevel; requiresApproval: boolean; matchedRuleId: string; rationale: string } {
  const sectionNorm = (targetSection || '').toLowerCase();

  // Search matching rules in order of specificity
  for (const rule of DECLARATIVE_RISK_RULES) {
    const fileMatches = !rule.targetFile || rule.targetFile === '*' || rule.targetFile === targetFile;
    const opMatches = !rule.operation || rule.operation === '*' || rule.operation === operation;
    const secMatches = !rule.targetSection || rule.targetSection === '*' || sectionNorm === rule.targetSection.toLowerCase();

    if (fileMatches && opMatches && secMatches) {
      return {
        riskLevel: rule.riskLevel,
        requiresApproval: rule.requiresApproval,
        matchedRuleId: rule.id,
        rationale: rule.rationale,
      };
    }
  }

  // Fallback defaults
  if (targetFile === 'SOUL.md') {
    return {
      riskLevel: 'high',
      requiresApproval: true,
      matchedRuleId: 'fallback_soul',
      rationale: 'Default high risk for SOUL.md modifications.',
    };
  }

  return {
    riskLevel: 'medium',
    requiresApproval: true,
    matchedRuleId: 'fallback_default',
    rationale: 'Standard approval requirement for persona mutation.',
  };
}
