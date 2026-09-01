import { taskRegistry } from '../core/taskRegistry';
import { contextEngine } from '../core/contextEngine';
import { GitExecutor } from './gitExecutor';
import { notificationService } from '../telegram/notificationService';
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
