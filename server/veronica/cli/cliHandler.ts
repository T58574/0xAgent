import { taskRegistry } from '../core/taskRegistry';
import { contextEngine } from '../core/contextEngine';
import { GitExecutor } from './gitExecutor';
import { notificationService } from '../telegram/notificationService';
import { projectDiscovery } from '../core/projectDiscovery';
import { projectDocManager } from '../core/projectDocManager';
import { antigravityAdapter } from '../adapters/antigravityAdapter';
import { operationalJournal } from '../core/operationalJournal';
import { TaskStatus } from '../types';

export interface CliRequest {
  command: string;
  project?: string;
  task_id?: string;
  task_token?: string;
  action?: string;
  progress?: string;
  status?: string;
  summary?: string;
  message?: string;
  fatal?: boolean;
  files?: string[];
  project_path?: string;
  content?: string;
  skill?: string;
  custom_prompt?: string;
  metrics?: Record<string, any>;
  changes?: string[] | string;
  important?: boolean;
  commit_hash?: string;
  agent?: string;
  recent?: boolean;
  architecture?: boolean;
  limit?: number;
  offset?: number;
}

export class CliHandler {
  public static async handleRequest(req: CliRequest): Promise<{
    success: boolean;
    data?: any;
    error?: string;
  }> {
    const { command } = req;

    switch (command) {
      case 'context': {
        if (!req.project) {
          return { success: false, error: 'Project name is required' };
        }
        const contextStr = await contextEngine.getProjectContext(req.project, {
          task: req.task_id,
          recent: req.recent,
          architecture: req.architecture,
        });
        return { success: true, data: contextStr };
      }

      case 'heartbeat': {
        if (!req.task_id) {
          return { success: false, error: 'task_id is required' };
        }
        await taskRegistry.recordHeartbeat(req.task_id, req.action, req.progress);
        return { success: true, data: { recorded: true } };
      }

      case 'report': {
        if (!req.task_id && !req.project) {
          return { success: false, error: 'Either task_id or project is required' };
        }
        const finalStatus = (req.status as TaskStatus) || 'completed';
        const summary = req.summary || req.message || 'Task completed';

        let targetProject = req.project;
        let skillName = req.skill || 'custom_task';

        if (req.task_id) {
          const existingTask = taskRegistry.getTask(req.task_id);
          const wasAlreadyCompleted = existingTask?.status === 'completed';

          await taskRegistry.updateTaskStatus(req.task_id, finalStatus, {
            summary,
          });
          const task = taskRegistry.getTask(req.task_id);
          if (task) {
            targetProject = targetProject || task.project;
            skillName = task.skill;
            if (finalStatus === 'completed' && !wasAlreadyCompleted) {
              await notificationService.notifyTaskCompleted(task, req.changes);
            }
          }
        }

        if (targetProject) {
          // Log into Operational Journal
          const journalEntry = await operationalJournal.logEntry({
            project: targetProject,
            task_id: req.task_id || null,
            agent: req.agent || 'Antigravity Agent',
            operation_type: skillName,
            status: finalStatus,
            summary,
            changes: req.changes ? (Array.isArray(req.changes) ? req.changes : [req.changes]) : null,
            important: req.important,
            commit_hash: req.commit_hash,
          });

          return { success: true, data: { status: finalStatus, journal_id: journalEntry.id } };
        }

        return { success: true, data: { status: finalStatus } };
      }

      case 'history': {
        const history = operationalJournal.getHistory(req.project, {
          limit: req.limit || 20,
          offset: req.offset || 0,
          importantOnly: req.important,
          task_id: req.task_id,
        });
        return { success: true, data: history };
      }

      case 'state_update': {
        if (!req.project) {
          return { success: false, error: 'Project name is required' };
        }
        if (req.metrics) {
          projectDocManager.updateMetrics(req.project, req.metrics);
        }
        const entry = await operationalJournal.logEntry({
          project: req.project,
          task_id: req.task_id || null,
          agent: req.agent || 'State Manager',
          operation_type: 'state_update',
          status: 'completed',
          summary: req.summary || req.message || 'State updated',
          changes: req.changes ? (Array.isArray(req.changes) ? req.changes : [req.changes]) : null,
          important: req.important,
        });
        return { success: true, data: entry };
      }

      case 'error': {
        if (!req.task_id) {
          return { success: false, error: 'task_id is required' };
        }
        await taskRegistry.logEvent({
          task_id: req.task_id,
          event_type: 'error',
          timestamp: Date.now(),
          message: req.message || 'Unknown agent error',
        });

        if (req.fatal) {
          await taskRegistry.updateTaskStatus(req.task_id, 'failed', {
            error_message: req.message,
          });
          const task = taskRegistry.getTask(req.task_id);
          if (task) {
            if (task.project) {
              await operationalJournal.logEntry({
                project: task.project,
                task_id: task.id,
                agent: req.agent || 'Antigravity Agent',
                operation_type: 'incident',
                status: 'failed',
                summary: `Fatal error: ${req.message || 'Agent crashed'}`,
                important: true,
              });
            }
            await notificationService.notifyTaskCrashed(task, req.message || 'Fatal agent error');
          }
        }
        return { success: true, data: { logged: true } };
      }

      case 'doc_get': {
        if (!req.project) {
          return { success: false, error: 'Project name is required' };
        }
        const passport = await projectDocManager.getPassport(req.project);
        const metrics = projectDocManager.getMetrics(req.project);
        const changelog = await projectDocManager.getChangelog(req.project, 20);
        return {
          success: true,
          data: {
            project: req.project,
            passport,
            metrics,
            changelog,
          },
        };
      }

      case 'doc_update':
      case 'doc_append': {
        if (!req.project) {
          return { success: false, error: 'Project name is required' };
        }
        if (req.content) {
          await projectDocManager.savePassport(req.project, req.content);
        }
        if (req.message || req.action) {
          await operationalJournal.logEntry({
            project: req.project,
            task_id: req.task_id || null,
            agent: req.agent || (req.task_id ? `Task ${req.task_id.substring(0, 8)}` : 'Agent CLI'),
            operation_type: req.action || 'doc_update',
            status: 'completed',
            summary: req.message || req.summary || 'Documentation update',
            changes: req.changes ? (Array.isArray(req.changes) ? req.changes : [req.changes]) : null,
            important: req.important,
          });
        }
        if (req.metrics) {
          projectDocManager.updateMetrics(req.project, req.metrics);
        }
        return { success: true, data: { updated: true } };
      }

      case 'projects_list': {
        const projects = await projectDiscovery.discoverAllProjects();
        return { success: true, data: projects };
      }

      case 'project_status': {
        if (!req.project) {
          return { success: false, error: 'Project name is required' };
        }
        const overview = await projectDocManager.getConsolidatedOverview(req.project);
        const metrics = projectDocManager.getMetrics(req.project);
        const history = operationalJournal.getHistory(req.project, { limit: 5 });
        return {
          success: true,
          data: {
            project: req.project,
            overview,
            metrics,
            recent_activity: history,
          },
        };
      }

      case 'task_create': {
        if (!req.project) {
          return { success: false, error: 'Project name is required' };
        }
        const task = await antigravityAdapter.spawnTask({
          project: req.project,
          skill: req.skill || 'custom_task',
          custom_prompt: req.custom_prompt || req.message,
        });
        return { success: true, data: task };
      }

      case 'task_update': {
        if (!req.task_id) {
          return { success: false, error: 'task_id is required' };
        }
        const updateStatus = (req.status as TaskStatus) || 'running';
        await taskRegistry.updateTaskStatus(req.task_id, updateStatus, {
          summary: req.summary,
        });
        if (req.action || req.progress) {
          await taskRegistry.recordHeartbeat(req.task_id, req.action, req.progress);
        }
        const updatedTask = taskRegistry.getTask(req.task_id);
        return { success: true, data: updatedTask };
      }

      case 'task_get': {
        if (!req.task_id) {
          return { success: false, error: 'task_id is required' };
        }
        const task = taskRegistry.getTask(req.task_id);
        return { success: true, data: task };
      }

      case 'git_commit': {
        if (!req.task_id || !req.message) {
          return { success: false, error: 'task_id and message are required' };
        }
        const projectPath = req.project_path || process.cwd();
        const res = await GitExecutor.executeCommit({
          taskId: req.task_id,
          projectPath,
          message: req.message,
          files: req.files,
        });
        return res;
      }

      case 'git_rollback': {
        if (!req.task_id) {
          return { success: false, error: 'task_id is required' };
        }
        const projectPath = req.project_path || process.cwd();
        return GitExecutor.executeRollback({
          taskId: req.task_id,
          projectPath,
        });
      }

      case 'agents_list': {
        const tasks = taskRegistry.getActiveTasks();
        return { success: true, data: tasks };
      }

      case 'task_list':
      case 'tasks_list': {
        const tasks = taskRegistry.listTasks({
          project: req.project,
          status: req.status as TaskStatus,
          limit: req.limit || 20,
        });
        return { success: true, data: tasks };
      }

      default:
        return { success: false, error: `Unknown CLI command '${command}'` };
    }
  }
}

