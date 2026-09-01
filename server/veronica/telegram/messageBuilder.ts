import { getVeronicaDb } from '../db/veronicaDb';
import { snapshotCache } from '../core/snapshotCache';
import { taskRegistry } from '../core/taskRegistry';
import { remoteNodeService } from '../../remoteNodeService';

function escapeHtml(text: string): string {
  return (text || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export class MessageBuilder {
  public static buildStatusMessage(): string {
    const activeTasks = taskRegistry.getActiveTasks();
    const remoteStatus = remoteNodeService.getStatus();

    const lines: string[] = [
      `🤖 <b>Вероника :: Статус Системы</b>`,
      `━━━━━━━━━━━━━━━━━━━━━━`,
      `🔹 <b>Активных задач:</b> ${activeTasks.length}`,
      `🔹 <b>GPU Compute Node:</b> ${
        remoteStatus.online
          ? `🟢 Online (${escapeHtml(remoteStatus.host)}:${remoteStatus.port}) — ${remoteStatus.latencyMs}ms`
          : `🔴 Offline (${escapeHtml(remoteStatus.host)})`
      }`,
    ];

    if (activeTasks.length > 0) {
      lines.push(`\n📋 <b>Текущие задачи в работе:</b>`);
      for (const t of activeTasks) {
        const pingSec = Math.round((Date.now() - (t.last_heartbeat || t.started_at)) / 1000);
        lines.push(
          `• <code>${t.id.substring(0, 8)}</code> | <b>${escapeHtml(t.project)}</b> | skill: <i>${escapeHtml(t.skill)}</i> | last ping: ${pingSec}s ago`
        );
      }
    } else {
      lines.push(`\n<i>Все агенты в режиме ожидания.</i>`);
    }

    return lines.join('\n');
  }

  public static buildProjectsSummary(): string {
    const snapshots = snapshotCache.getAllSnapshots();
    if (snapshots.length === 0) {
      return `📁 <b>Проекты:</b> Нет зарегистрированных проектов.`;
    }

    const lines: string[] = [`📁 <b>Сводка по проектам:</b>`, `━━━━━━━━━━━━━━━━━━━━━━`];
    for (const s of snapshots) {
      lines.push(
        `🔸 <b>${escapeHtml(s.project)}</b> (активных: ${s.active_tasks_count}, ожидает: ${s.pending_attention_count})`
      );
      if (s.dense_context_summary) {
        lines.push(`   <i>${escapeHtml(s.dense_context_summary)}</i>`);
      }
    }
    return lines.join('\n');
  }

  public static buildPeriodReport(period: 'today' | 'yesterday'): string {
    const db = getVeronicaDb();
    const now = new Date();
    let startOfDay: number;
    let endOfDay: number;

    if (period === 'today') {
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      startOfDay = today.getTime();
      endOfDay = Date.now();
    } else {
      const yesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
      startOfDay = yesterday.getTime();
      endOfDay = startOfDay + 24 * 60 * 60 * 1000;
    }

    const stmt = db.prepare(`
      SELECT project, skill, status, summary, started_at, finished_at
      FROM agent_tasks
      WHERE started_at >= ? AND started_at < ?
      ORDER BY project, started_at DESC
    `);
    const tasks: any[] = stmt.all(startOfDay, endOfDay) as any[];

    const periodLabel = period === 'today' ? 'сегодня' : 'вчера';

    if (tasks.length === 0) {
      return `📊 <b>Отчет за ${periodLabel}:</b> Задач не выполнялось.`;
    }

    const lines: string[] = [
      `📊 <b>Отчет по задачам за ${periodLabel} (${tasks.length}):</b>`,
      `━━━━━━━━━━━━━━━━━━━━━━`,
    ];

    const grouped: Record<string, any[]> = {};
    for (const t of tasks) {
      if (!grouped[t.project]) grouped[t.project] = [];
      grouped[t.project].push(t);
    }

    for (const [project, pTasks] of Object.entries(grouped)) {
      lines.push(`\n📂 <b>${escapeHtml(project)}:</b>`);
      for (const t of pTasks) {
        const icon = t.status === 'completed' ? '✅' : t.status === 'running' ? '⏳' : '❌';
        const summary = escapeHtml(t.summary || 'без описания');
        lines.push(`  ${icon} <i>${escapeHtml(t.skill)}</i> [${t.status}]: ${summary}`);
      }
    }

    return lines.join('\n');
  }
}
