import { getMemoryDb } from './memoryDb';
import { EvolutionDashboardSummary, EvolutionTelemetryRecord } from '../src/types';

/**
 * Aggregates evolution telemetry and memory health metrics for the dashboard.
 */
export function getEvolutionDashboardSummary(_timeframeDays: number = 30): EvolutionDashboardSummary {
  const db = getMemoryDb();

  // 1. Proposals & Guard Summary
  const proposalsTotal = (db.prepare(`SELECT COUNT(*) as cnt FROM persona_change_proposals`).get() as any)?.cnt || 0;
  const appliedTotal = (db.prepare(`SELECT COUNT(*) as cnt FROM persona_change_proposals WHERE status = 'applied'`).get() as any)?.cnt || 0;
  const revertedTotal = (db.prepare(`SELECT COUNT(*) as cnt FROM persona_change_proposals WHERE status = 'reverted'`).get() as any)?.cnt || 0;

  const regressionBlockedTotal = (db.prepare(`SELECT COUNT(*) as cnt FROM regression_checks WHERE blocked = 1`).get() as any)?.cnt || 0;
  const avgDeltaRow = db.prepare(`SELECT AVG(delta) as avg_delta FROM regression_checks`).get() as any;
  const avgScoreDelta = avgDeltaRow?.avg_delta !== null && avgDeltaRow?.avg_delta !== undefined
    ? Math.round(avgDeltaRow.avg_delta * 1000) / 10
    : 0;

  const applyRate = proposalsTotal > 0 ? Math.round((appliedTotal / proposalsTotal) * 100) : 0;
  const blockRate = proposalsTotal > 0 ? Math.round((regressionBlockedTotal / proposalsTotal) * 100) : 0;
  const revertRate = appliedTotal > 0 ? Math.round((revertedTotal / appliedTotal) * 100) : 0;

  // 2. Trends: Daily proposals & blocks (last 14 days)
  const dailyProposalsRows = db.prepare(`
    SELECT SUBSTR(created_at, 1, 10) as day, COUNT(*) as cnt
    FROM persona_change_proposals
    GROUP BY SUBSTR(created_at, 1, 10)
    ORDER BY day ASC
    LIMIT 14
  `).all() as any[];

  const dailyBlocksRows = db.prepare(`
    SELECT SUBSTR(created_at, 1, 10) as day, COUNT(*) as cnt
    FROM regression_checks
    WHERE blocked = 1
    GROUP BY SUBSTR(created_at, 1, 10)
    ORDER BY day ASC
    LIMIT 14
  `).all() as any[];

  const complianceTrajectoryRows = db.prepare(`
    SELECT SUBSTR(created_at, 1, 10) as day, AVG(proposed_composite) * 100 as avg_score
    FROM regression_checks
    GROUP BY SUBSTR(created_at, 1, 10)
    ORDER BY day ASC
    LIMIT 14
  `).all() as any[];

  // 3. Quality breakdown
  const riskRows = db.prepare(`
    SELECT risk_level as risk, COUNT(*) as count
    FROM persona_change_proposals
    GROUP BY risk_level
    ORDER BY count DESC
  `).all() as any[];

  const blockedOpRows = db.prepare(`
    SELECT p.operation, COUNT(*) as count
    FROM regression_checks r
    JOIN persona_change_proposals p ON r.proposal_id = p.id
    WHERE r.blocked = 1
    GROUP BY p.operation
    ORDER BY count DESC
  `).all() as any[];

  // 4. Memory Health
  const activeMemCount = (db.prepare(`SELECT COUNT(*) as cnt FROM canonical_memories WHERE status = 'active'`).get() as any)?.cnt || 0;
  const archivedMemCount = (db.prepare(`SELECT COUNT(*) as cnt FROM canonical_memories WHERE status = 'archived'`).get() as any)?.cnt || 0;
  const avgConfRow = db.prepare(`SELECT AVG(confidence) as avg_conf FROM canonical_memories WHERE status = 'active'`).get() as any;
  const avgConfidence = avgConfRow?.avg_conf !== null && avgConfRow?.avg_conf !== undefined
    ? Math.round(avgConfRow.avg_conf * 100) / 100
    : 1.0;

  const recentDecayEvents = (db.prepare(`SELECT COUNT(*) as cnt FROM memory_decay_logs`).get() as any)?.cnt || 0;

  return {
    summary: {
      totalProposals: proposalsTotal,
      appliedProposals: appliedTotal,
      blockedProposals: regressionBlockedTotal,
      revertedProposals: revertedTotal,
      applyRate,
      blockRate,
      revertRate,
      avgScoreDelta,
    },
    trends: {
      dailyProposals: dailyProposalsRows.map((r) => ({ date: r.day, count: r.cnt })),
      dailyBlocks: dailyBlocksRows.map((r) => ({ date: r.day, count: r.cnt })),
      complianceScoreOverTime: complianceTrajectoryRows.map((r) => ({ date: r.day, score: Math.round(r.avg_score) })),
    },
    quality: {
      topRiskLevels: riskRows.map((r) => ({ risk: r.risk, count: r.count })),
      mostBlockedOperations: blockedOpRows.map((r) => ({ operation: r.operation, count: r.count })),
    },
    memory: {
      activeMemories: activeMemCount,
      archivedMemories: archivedMemCount,
      avgConfidence,
      recentDecayEvents,
    },
  };
}

/**
 * Returns latest telemetry events.
 */
export function getRecentEvolutionTelemetry(limit: number = 20): EvolutionTelemetryRecord[] {
  const db = getMemoryDb();
  const rows = db.prepare(`
    SELECT * FROM evolution_telemetry
    ORDER BY created_at DESC
    LIMIT ?
  `).all(limit) as any[];

  return rows.map((r) => ({
    ...r,
    regression_blocked: Boolean(r.regression_blocked),
  }));
}
