import { taskRegistry } from '../core/taskRegistry';
import { contextEngine } from '../core/contextEngine';
import { GitExecutor } from './gitExecutor';
import { notificationService } from '../telegram/notificationService';
import { projectDiscovery } from '../core/projectDiscovery';
import { projectDocManager } from '../core/projectDocManager';
import { antigravityAdapter } from '../adapters/antigravityAdapter';
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
        if (!req.task_id) {
          return { success: false, error: 'task_id is required' };
        }
        const finalStatus = (req.status as TaskStatus) || 'completed';
        await taskRegistry.updateTaskStatus(req.task_id, finalStatus, {
          summary: req.summary || 'Completed',
        });
        const task = taskRegistry.getTask(req.task_id);
        if (task) {
          if (task.project) {
            await projectDocManager.appendChangelog(task.project, {
              author: 'CLI Report',
              taskId: task.id,
              action: `Task finished [${finalStatus}]`,
              details: req.summary || '',
            });
          }
          await notificationService.notifyTaskCompleted(task);
        }
        return { success: true, data: { status: finalStatus } };
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
          await projectDocManager.appendChangelog(req.project, {
            author: req.task_id ? `Task ${req.task_id.substring(0, 8)}` : 'Agent CLI',
            taskId: req.task_id,
            action: req.action || 'Documentation Update',
            details: req.message || req.summary || '',
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

      default:
        return { success: false, error: `Unknown CLI command '${command}'` };
    }
  }
}
