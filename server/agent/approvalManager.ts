import crypto from 'node:crypto';
import { RequestApprovalPayload, ApprovalResult } from '../../src/types';

export interface PendingApprovalTicket {
  id: string;
  sessionId: string;
  toolCallId: string;
  nonce: string;
  payload: RequestApprovalPayload;
  contentHash: string;
  createdAt: number;
  expiresAt: number;
  resolve: (result: ApprovalResult) => void;
}

export const DEFAULT_APPROVAL_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes

// In-memory store of active pending approvals
const activeApprovalTickets = new Map<string, PendingApprovalTicket>();

/**
 * Computes deterministic SHA-256 hash for content/artifacts verification
 */
export function computeContentHash(content: string | undefined | null): string {
  if (!content) return '';
  return crypto.createHash('sha256').update(content.trim(), 'utf8').digest('hex');
}

/**
 * Creates and registers a new pending approval ticket with cryptographic nonce and content hash
 */
export function createApprovalTicket(
  sessionId: string,
  toolCallId: string,
  payload: RequestApprovalPayload,
  timeoutMs: number = DEFAULT_APPROVAL_TIMEOUT_MS
): { ticket: Omit<PendingApprovalTicket, 'resolve'>; promise: Promise<ApprovalResult> } {
  const nonce = crypto.randomUUID();
  const contentHash = computeContentHash(payload.content_to_verify || JSON.stringify(payload.target_artifacts));
  const createdAt = Date.now();
  const expiresAt = createdAt + timeoutMs;
  const id = `${sessionId}:${toolCallId}`;

  payload.nonce = nonce;
  payload.content_hash = contentHash;

  let resolver: (result: ApprovalResult) => void = () => {};

  const promise = new Promise<ApprovalResult>((resolve) => {
    resolver = resolve;
  });

  const ticket: PendingApprovalTicket = {
    id,
    sessionId,
    toolCallId,
    nonce,
    payload,
    contentHash,
    createdAt,
    expiresAt,
    resolve: resolver,
  };

  activeApprovalTickets.set(id, ticket);
  activeApprovalTickets.set(nonce, ticket);

  return { ticket, promise };
}

/**
 * Resolves a pending approval ticket.
 * Enforces cryptographic nonce verification and SHA-256 content hash integrity.
 */
export function resolveApprovalTicket(
  ticketOrNonce: string,
  approved: boolean,
  overrideText?: string,
  currentContentToVerify?: string
): ApprovalResult {
  const ticket = activeApprovalTickets.get(ticketOrNonce);

  if (!ticket) {
    return {
      status: 'expired',
      nonce: ticketOrNonce,
      reason: 'Approval ticket not found or already resolved.',
    };
  }

  // Clean up references
  activeApprovalTickets.delete(ticket.id);
  activeApprovalTickets.delete(ticket.nonce);

  // Check expiration timeout
  if (Date.now() > ticket.expiresAt) {
    const expiredResult: ApprovalResult = {
      status: 'expired',
      nonce: ticket.nonce,
      reason: 'Approval ticket expired by timeout.',
    };
    ticket.resolve(expiredResult);
    return expiredResult;
  }

  // Validate content hash integrity if content was provided
  if (currentContentToVerify !== undefined && ticket.contentHash) {
    const currentHash = computeContentHash(currentContentToVerify);
    if (currentHash !== ticket.contentHash) {
      const staleResult: ApprovalResult = {
        status: 'expired',
        nonce: ticket.nonce,
        reason: 'STALE_APPROVAL_REJECTED: Target artifact or command payload was modified before approval.',
      };
      ticket.resolve(staleResult);
      return staleResult;
    }
  }

  const finalResult: ApprovalResult = {
    status: approved ? 'approved' : 'rejected',
    nonce: ticket.nonce,
    override_text: overrideText?.trim() || undefined,
  };

  ticket.resolve(finalResult);
  return finalResult;
}

/**
 * Preemption: Cancels all pending approval tickets for a session when the user types free text
 */
export function cancelPendingApprovalsForSession(sessionId: string, reason: string = 'Interrupted by user free-text intent'): number {
  let cancelledCount = 0;
  const uniqueTickets = Array.from(new Set(activeApprovalTickets.values()));

  for (const ticket of uniqueTickets) {
    if (ticket.sessionId === sessionId) {
      activeApprovalTickets.delete(ticket.id);
      activeApprovalTickets.delete(ticket.nonce);
      ticket.resolve({
        status: 'rejected',
        nonce: ticket.nonce,
        reason,
      });
      cancelledCount++;
    }
  }

  return cancelledCount;
}

/**
 * Retrieves an active approval ticket by sessionId and toolCallId or nonce
 */
export function getActiveApprovalTicket(idOrNonce: string): PendingApprovalTicket | undefined {
  return activeApprovalTickets.get(idOrNonce);
}

/**
 * Lists all active pending approvals
 */
export function listActiveApprovalTickets(): PendingApprovalTicket[] {
  const uniqueTickets = new Set<PendingApprovalTicket>(activeApprovalTickets.values());
  return Array.from(uniqueTickets);
}
