import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { detectModelReasoningCapabilities, parseGgufMetadata } from '../server/ggufParser';
import path from 'node:path';

describe('FastMTP & Speculative Decoding Integration Suite', () => {
  it('should detect Qwen 3.8 reasoning and family capabilities', () => {
    const caps = detectModelReasoningCapabilities(
      'Qwen3.8-27B-IQ3_M',
      'Qwen3.8-27B-IQ3_M.gguf',
      'qwen35'
    );
    assert.equal(caps.family, 'qwen');
    assert.equal(caps.supportsReasoning, true);
    assert.equal(caps.recommendedReasoningEffort, 'xhigh');
  });

  it('should identify FastMTP draft sidecar file patterns', () => {
    const draftFileName = 'Qwen3.8-27B-FastMTP-32K.gguf';
    const isDraft = /fastmtp|mtp|draft/i.test(draftFileName);
    const isFastMtp = /fastmtp/i.test(draftFileName);
    assert.equal(isDraft, true);
    assert.equal(isFastMtp, true);
  });
});
