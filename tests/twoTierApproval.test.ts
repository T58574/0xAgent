import { describe, it } from 'node:test';
import assert from 'node:assert';
import { parseToolCalls } from '../server/agent/toolParser';
import {
  createApprovalTicket,
  resolveApprovalTicket,
  getPendingApprovalTicket,
  cancelPendingApprovalsForSession,
  computeContentHash,
} from '../server/agent/approvalManager';
import { extractQuickResponses, cleanContent } from '../src/utils/helpers';
import { formatMessageContent } from '../server/agent/promptBuilder';
import { ChatMessage, RequestApprovalPayload } from '../src/types';

describe('Two-Tier Approval Protocol', () => {
  describe('Tier 1: Quick Replies (Non-blocking Intent Suggestions)', () => {
    it('extracts quick replies from JSON array inside <quick_replies>', () => {
      const assistantText = `
Here are some suggested next steps:
<quick_replies>
[
  { "id": "1", "label": "Review Authentication Logic", "prompt": "Review auth.ts for token expiration", "action_type": "send_prompt" },
  { "id": "2", "label": "Show Git Diff", "prompt": "Show git diff for staged files", "action_type": "open_diff" },
  { "id": "3", "label": "Explain Architecture Decision", "prompt": "Explain why we used SHA-256", "action_type": "explain" }
]
</quick_replies>
      `;

      const res = extractQuickResponses(assistantText);
      assert.strictEqual(res.options.length, 3);
      assert.strictEqual(res.options[0].id, '1');
      assert.strictEqual(res.options[0].label, 'Review Authentication Logic');
      assert.strictEqual(res.options[0].prompt, 'Review auth.ts for token expiration');
      assert.strictEqual(res.options[0].action_type, 'send_prompt');
      assert.strictEqual(res.cleanText.includes('<quick_replies>'), false);
    });

    it('enforces maximum 4 items and 28 character label limit', () => {
      const assistantText = `
<quick_replies>
[
  { "id": "1", "label": "This label is definitely way too long for a single compact button", "prompt": "P1" },
  { "id": "2", "label": "Option 2", "prompt": "P2" },
  { "id": "3", "label": "Option 3", "prompt": "P3" },
  { "id": "4", "label": "Option 4", "prompt": "P4" },
  { "id": "5", "label": "Option 5 - Should be excluded", "prompt": "P5" }
]
</quick_replies>
      `;

      const res = extractQuickResponses(assistantText);
      assert.strictEqual(res.options.length, 4);
      assert.strictEqual(res.options[0].label.length <= 28, true);
      assert.strictEqual(res.options[0].label.endsWith('...'), true);
    });

    it('strips <quick_replies> and <quick_response> from assistant history for context hygiene', () => {
      const msg: ChatMessage = {
        id: 'm1',
        role: 'assistant',
        content: `I analyzed the codebase.
<quick_replies>
[{"label": "Run Tests", "prompt": "run tests"}]
</quick_replies>
<quick_response>
  <option key="1" label="OK" action="ok" />
</quick_response>
Done!`,
      };

      const formatted = formatMessageContent(msg, true);
      assert.strictEqual(typeof formatted === 'string' && formatted.includes('<quick_replies>'), false);
      assert.strictEqual(typeof formatted === 'string' && formatted.includes('Run Tests'), false);
      assert.strictEqual(typeof formatted === 'string' && formatted.includes('<quick_response>'), false);
      assert.strictEqual(typeof formatted === 'string' && formatted.includes('I analyzed the codebase.'), true);
      assert.strictEqual(typeof formatted === 'string' && formatted.includes('Done!'), true);
    });
  });

  describe('Tier 2: Approval Gate (Blocking Destructive Actions)', () => {
    it('parses declarative <request_approval> tag into tool call', () => {
      const rawText = `
I need your confirmation before applying changes to auth.ts:
<request_approval action_type="patch_file" risk_level="high" preview_summary="Add JWT validation logic" target_artifacts='["src/auth.ts"]'>
<<<<<<< SEARCH
export function login() {}
=======
export function login() { validateJwt(); }
>>>>>>> REPLACE
</request_approval>
      `;

      const calls = parseToolCalls(rawText);
      assert.strictEqual(calls.length, 1);
      assert.strictEqual(calls[0].name, 'request_approval');
      assert.strictEqual(calls[0].arguments.action_type, 'patch_file');
      assert.strictEqual(calls[0].arguments.risk_level, 'high');
      assert.strictEqual(calls[0].arguments.preview_summary, 'Add JWT validation logic');
      assert.strictEqual(calls[0].arguments.target_artifacts.includes('src/auth.ts'), true);
      assert.strictEqual(calls[0].arguments.content_to_verify.includes('<<<<<<< SEARCH'), true);
    });

    it('creates cryptographic ticket with UUID nonce and SHA-256 hash', async () => {
      const payload: RequestApprovalPayload = {
        action_type: 'execute_command',
        target_artifacts: ['package.json'],
        risk_level: 'critical',
        preview_summary: 'Install external dependencies',
        content_to_verify: 'npm install rimraf',
      };

      const { ticket, promise } = createApprovalTicket('session_123', 'tc_001', payload);

      assert.strictEqual(Boolean(ticket.nonce), true);
      assert.strictEqual(ticket.nonce.length > 10, true);
      assert.strictEqual(ticket.contentHash, computeContentHash('npm install rimraf'));

      // Resolve approved
      const resolveRes = resolveApprovalTicket(ticket.nonce, true);
      assert.strictEqual(resolveRes.status, 'approved');
      assert.strictEqual(resolveRes.nonce, ticket.nonce);

      const asyncResult = await promise;
      assert.strictEqual(asyncResult.status, 'approved');
      assert.strictEqual(asyncResult.nonce, ticket.nonce);
    });

    it('rejects stale approval if content changed before resolution', async () => {
      const payload: RequestApprovalPayload = {
        action_type: 'write_file',
        target_artifacts: ['src/config.ts'],
        risk_level: 'high',
        preview_summary: 'Overwrite configuration file',
        content_to_verify: 'PORT=3000',
      };

      const { ticket, promise } = createApprovalTicket('session_123', 'tc_002', payload);

      // Attempt to resolve with modified content
      const resolveRes = resolveApprovalTicket(ticket.nonce, true, undefined, 'PORT=8080');
      assert.strictEqual(resolveRes.status, 'expired');
      assert.strictEqual(resolveRes.reason?.includes('STALE_APPROVAL_REJECTED'), true);

      const asyncResult = await promise;
      assert.strictEqual(asyncResult.status, 'expired');
    });

    it('supports user preemption and cancellations when free text is sent', async () => {
      const payload: RequestApprovalPayload = {
        action_type: 'delete_file',
        target_artifacts: ['tmp/cache.db'],
        risk_level: 'high',
        preview_summary: 'Delete temporary cache',
      };

      const uniqueSessionId = `session_preempt_${Date.now()}`;
      const { ticket, promise } = createApprovalTicket(uniqueSessionId, 'tc_003', payload);

      // User interrupts with new prompt
      const cancelledCount = cancelPendingApprovalsForSession(uniqueSessionId, 'Interrupted by new user prompt');
      assert.strictEqual(cancelledCount, 1);

      const asyncResult = await promise;
      assert.strictEqual(asyncResult.status, 'rejected');
      assert.strictEqual(asyncResult.reason?.includes('Interrupted by new user prompt'), true);
    });
  });
});
