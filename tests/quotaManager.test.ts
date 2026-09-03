import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { quotaManager, parseResetDuration } from '../server/agent/quotaManager';
import { resolveModelContextMax } from '../server/agent/llmClient';

describe('QuotaManager & Telemetry Test Suite', () => {
  beforeEach(() => {
    quotaManager.clearQuota();
  });

  describe('parseResetDuration', () => {
    it('should parse "Resets in 2h 45m" format', () => {
      const res = parseResetDuration('Resets in 2h 45m');
      assert.ok(res);
      assert.equal(res.resetInSeconds, 2 * 3600 + 45 * 60);
      assert.equal(res.resetText, '2h 45m');
    });

    it('should parse "Resets in 15m 30s" format', () => {
      const res = parseResetDuration('Resets in 15m 30s');
      assert.ok(res);
      assert.equal(res.resetInSeconds, 15 * 60 + 30);
      assert.equal(res.resetText, '15m 30s');
    });

    it('should parse "retry in 42 seconds" format', () => {
      const res = parseResetDuration('Too many requests, please retry in 42 seconds');
      assert.ok(res);
      assert.equal(res.resetInSeconds, 42);
      assert.equal(res.resetText, '42s');
    });

    it('should parse raw numeric seconds from Retry-After header', () => {
      const res = parseResetDuration('Rate limit reached', '120');
      assert.ok(res);
      assert.equal(res.resetInSeconds, 120);
      assert.equal(res.resetText, '2m');
    });

    it('should parse HTTP Date format from Retry-After header', () => {
      const futureDate = new Date(Date.now() + 65000).toUTCString();
      const res = parseResetDuration('Exhausted', futureDate);
      assert.ok(res);
      assert.ok(res.resetInSeconds && res.resetInSeconds >= 60 && res.resetInSeconds <= 70);
    });

    it('should fallback to 60s default when no reset duration specified', () => {
      const res = parseResetDuration('Quota exceeded for project');
      assert.ok(res);
      assert.equal(res.resetInSeconds, 60);
      assert.equal(res.resetText, '60s');
    });
  });

  describe('isQuotaExhausted', () => {
    it('should detect HTTP 429 status code', () => {
      assert.equal(quotaManager.isQuotaExhausted('Some error', 429), true);
    });

    it('should detect RESOURCE_EXHAUSTED error text', () => {
      assert.equal(quotaManager.isQuotaExhausted('RESOURCE_EXHAUSTED: quota limit reached', 400), true);
    });

    it('should detect Google AI Studio / Antigravity quota exceeded message', () => {
      assert.equal(quotaManager.isQuotaExhausted('Resource has been exhausted (e.g. check quota- Resets in 1h)'), true);
    });

    it('should return false for regular non-quota errors', () => {
      assert.equal(quotaManager.isQuotaExhausted('Syntax error in input prompt', 400), false);
      assert.equal(quotaManager.isQuotaExhausted('Internal server error', 500), false);
    });
  });

  describe('recordQuotaExhaustion and clearQuota', () => {
    it('should correctly record quota exhaustion and notify listeners', () => {
      let broadcastEvent = '';
      let broadcastPayload: any = null;

      const broadcaster = (evt: string, payload: any) => {
        broadcastEvent = evt;
        broadcastPayload = payload;
      };

      const recorded = quotaManager.recordQuotaExhaustion({
        statusCode: 429,
        rawMessage: 'Rate limit hit. Resets in 10m',
        modelName: 'gemini-2.5-pro',
        broadcast: broadcaster,
      });

      assert.equal(recorded.exhausted, true);
      assert.equal(recorded.statusCode, 429);
      assert.equal(recorded.resetInSeconds, 600);
      assert.equal(recorded.resetText, '10m');
      assert.equal(recorded.modelName, 'gemini-2.5-pro');
      assert.ok(recorded.resetAt && recorded.resetAt > Date.now());

      assert.equal(broadcastEvent, 'quota-status-changed');
      assert.equal(broadcastPayload?.exhausted, true);

      // Verify getQuotaStatus reflects recorded status
      const current = quotaManager.getQuotaStatus();
      assert.equal(current.exhausted, true);

      // Clear quota
      const cleared = quotaManager.clearQuota();
      assert.equal(cleared.exhausted, false);
      assert.equal(quotaManager.getQuotaStatus().exhausted, false);
    });
  });

  describe('resolveModelContextMax', () => {
    const dummyConfig: any = {
      local_server: { ctx_size: 8192 },
      max_tokens: 4096,
    };

    it('should dynamically resolve 1,048,576 tokens for Gemini family models', () => {
      assert.equal(resolveModelContextMax('gemini-3.8-flash', dummyConfig), 1048576);
      assert.equal(resolveModelContextMax('gemini-3.7-flash', dummyConfig), 1048576);
      assert.equal(resolveModelContextMax('gemini-3.1-pro', dummyConfig), 1048576);
    });

    it('should dynamically resolve 200,000 tokens for Claude family models', () => {
      assert.equal(resolveModelContextMax('claude-sonnet-4-6', dummyConfig), 200000);
      assert.equal(resolveModelContextMax('claude-opus-4-6-thinking', dummyConfig), 200000);
    });

    it('should dynamically resolve 128,000 tokens for GPT/GPT-OSS family models', () => {
      assert.equal(resolveModelContextMax('gpt-oss-120b-medium', dummyConfig), 128000);
      assert.equal(resolveModelContextMax('gpt-5', dummyConfig), 128000);
    });

    it('should fallback to local_server.ctx_size for local models', () => {
      assert.equal(resolveModelContextMax('local:model.gguf', dummyConfig), 8192);
    });
  });

  describe('parseAgyUsageOutput', () => {
    it('should correctly parse standard agy -p /usage tab-separated output', () => {
      const raw = `Gemini Models\tWeekly Limit Remaining\t82%\t2026-09-09T23:47:54Z
Gemini Models\tFive Hour Limit Remaining\t94%\t2026-09-03T11:08:24Z
Claude and GPT models\tWeekly Limit Remaining\t100%\t2026-09-08T17:00:52Z
Claude and GPT models\tFive Hour Limit Remaining\t100%\t2026-09-03T11:24:22Z`;

      const limits = quotaManager.parseAgyUsageOutput(raw);
      assert.equal(limits.length, 4);

      assert.equal(limits[0].modelGroup, 'Gemini Models');
      assert.equal(limits[0].limitType, 'Weekly Limit Remaining');
      assert.equal(limits[0].remainingPercentage, 82);
      assert.equal(limits[0].resetAtUtc, '2026-09-09T23:47:54Z');

      assert.equal(limits[1].modelGroup, 'Gemini Models');
      assert.equal(limits[1].limitType, 'Five Hour Limit Remaining');
      assert.equal(limits[1].remainingPercentage, 94);
      assert.equal(limits[1].resetAtUtc, '2026-09-03T11:08:24Z');

      assert.equal(limits[2].modelGroup, 'Claude and GPT models');
      assert.equal(limits[2].remainingPercentage, 100);

      assert.equal(limits[3].modelGroup, 'Claude and GPT models');
      assert.equal(limits[3].limitType, 'Five Hour Limit Remaining');
      assert.equal(limits[3].remainingPercentage, 100);
    });

    it('should handle empty or malformed strings gracefully', () => {
      assert.deepEqual(quotaManager.parseAgyUsageOutput(''), []);
      assert.deepEqual(quotaManager.parseAgyUsageOutput('   \n  '), []);
      assert.deepEqual(quotaManager.parseAgyUsageOutput('some random non-table error text'), []);
    });
  });
});
