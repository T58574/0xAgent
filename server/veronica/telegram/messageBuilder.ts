import { getVeronicaDb } from '../db/veronicaDb';
import { snapshotCache } from '../core/snapshotCache';
import { taskRegistry } from '../core/taskRegistry';
import { remoteNodeService } from '../../remoteNodeService';

export class MessageBuilder {
  public static buildStatusMessage(): string {
    const activeTasks = taskRegistry.getActiveTasks();
    const remoteStatus = remoteNodeService.getStatus();

    const lines: string[] = [
      `🤖 *Вероника :: Статус Системы*`,
      `━━━━━━━━━━━━━━━━━━━━━━`,
      `🔹 *Активных задач:* ${activeTasks.length}`,
      `🔹 *GPU Compute Node:* ${remoteStatus.online ? `🟢 Online (${remoteStatus.host}:${remoteStatus.port}) — ${remoteStatus.latencyMs}ms` : `🔴 Offline (${remoteStatus.host})`}`,
    ];

    if (activeTasks.length > 0) {
      lines.push(`\n📋 *Текущие задачи в работе:*`);
      for (const t of activeTasks) {
        lines.push(`• \`${t.id.substring(0, 8)}\` | *${t.project}* | skill: _${t.skill}_ | last ping: ${Math.round((Date.now() - (t.last_heartbeat || t.started_at)) / 1000)}s ago`);
      }
    } else {
      lines.push(`\n_Все агенты в режиме ожидания._`);
    }

    return lines.join('\n');
  }

  public static buildProjectsSummary(): string {
    const snapshots = snapshotCache.getAllSnapshots();
    if (snapshots.length === 0) {
      return `📁 *Проекты:* Нет зарегистрированных проектов.`;
    }

    const lines: string[] = [`📁 *Сводка по проектам:*`, `━━━━━━━━━━━━━━━━━━━━━━`];
    for (const s of snapshots) {
      lines.push(`🔸 *${s.project}* (активных: ${s.active_tasks_count}, ожидает: ${s.pending_attention_count})`);
      lines.push(`   _${s.dense_context_summary}_`);
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

    if (tasks.length === 0) {
      return `📊 *Отчет за ${period === 'today' ? 'сегодня' : 'вчера'}:* Задач не выполнялось.`;
    }

    const lines: string[] = [
      `📊 *Отчет по задачам за ${period === 'today' ? 'сегодня' : 'вчера'} (${tasks.length}):*`,
      `━━━━━━━━━━━━━━━━━━━━━━`,
    ];

    const grouped: Record<string, any[]> = {};
    for (const t of tasks) {
      if (!grouped[t.project]) grouped[t.project] = [];
      grouped[t.project].push(t);
    }

    for (const [project, pTasks] of Object.entries(grouped)) {
      lines.push(`\n📂 *${project}:*`);
      for (const t of pTasks) {
        const icon = t.status === 'completed' ? '✅' : t.status === 'running' ? '⏳' : '❌';
        lines.push(`  ${icon} _${t.skill}_ [${t.status}]: ${t.summary || 'без описания'}`);
      }
    }

    return lines.join('\n');
  }
}
