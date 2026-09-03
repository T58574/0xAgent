import { get, post, del } from './core';
import { ChatSession, FileNode, ApprovalResult } from '../../types';

// Workspace & Files
export async function select_workspace(): Promise<string | null> {
  const data = await post<{ folder: string | null }>('/select-workspace');
  return data.folder;
}

export async function select_file_native(filter?: string): Promise<string | null> {
  const data = await post<{ filePath: string | null }>('/select-file', { filter });
  return data.filePath;
}

export const get_workspace_tree = (workspaceDir?: string | null) =>
  get<FileNode[]>(workspaceDir ? `/workspace-tree?workspaceDir=${encodeURIComponent(workspaceDir)}` : '/workspace-tree');

export const get_workspace_context = (workspaceDir?: string | null) =>
  get<{ loaded: boolean; filePath: string | null; filename: string | null; content: string | null }>(
    workspaceDir ? `/workspace-context?workspaceDir=${encodeURIComponent(workspaceDir)}` : '/workspace-context'
  );

export async function read_file_raw(path: string, workspaceDir?: string | null): Promise<string> {
  const url = workspaceDir
    ? `/read-file-raw?path=${encodeURIComponent(path)}&workspaceDir=${encodeURIComponent(workspaceDir)}`
    : `/read-file-raw?path=${encodeURIComponent(path)}`;
  const data = await get<{ content: string }>(url);
  return data.content;
}

export const write_file_raw = (path: string, content: string, workspaceDir?: string | null) =>
  post<void>('/write-file-raw', { path, content, workspaceDir });

// Sessions
export const list_sessions = () => get<ChatSession[]>('/sessions');
export const load_session = (id: string) => get<ChatSession>(`/sessions/${id}`);
export const save_session = (session: ChatSession) => post<void>(`/sessions/${session.id}/save`, session);
export const create_session = (title?: string, workspace_dir?: string | null) =>
  post<ChatSession>('/sessions', { title, workspace_dir });
export const create_auto_workspace = () => post<{ slug: string; path: string }>('/workspaces/create-auto');
export const update_session_workspace = (sessionId: string, workspace_dir: string | null) =>
  post<ChatSession>(`/sessions/${sessionId}/workspace`, { workspace_dir });
export const delete_session = (id: string) => del<void>(`/sessions/${id}`);
export const fork_session = (sessionId: string, fromMessageId?: string, newTitle?: string) =>
  post<any>(`/sessions/${sessionId}/fork`, { fromMessageId, newTitle });
export const rollback_session = (
  sessionId: string,
  targetMessageId: string,
  mode: 'to_user_edit' | 'to_assistant' = 'to_user_edit'
) => post<{ session: ChatSession; restoredContent: string }>(`/sessions/${sessionId}/rollback`, { targetMessageId, mode });

// Agent Messaging & Tool Interaction
export const send_message = (sessionId: string) => post<void>('/send-message', { sessionId });
export const cancel_agent = (sessionId: string) => post<void>('/cancel-agent', { sessionId });
export const respond_to_tool = (sessionId: string, toolCallId: string, approve: boolean | string) =>
  post<void>('/respond-to-tool', { sessionId, toolCallId, approve });
export const respond_to_approval = (ticketOrNonce: string, approve: boolean, overrideText?: string, currentContent?: string) =>
  post<ApprovalResult>('/respond-to-approval', { ticketOrNonce, approve, overrideText, currentContent });
export const answer_user_question = (toolCallId: string, answers: any[]) =>
  post<void>('/answer-question', { toolCallId, answers });
