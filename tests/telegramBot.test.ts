import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { markdownToTelegramHtml, escapeHtml, splitHtmlIntoBalancedChunks } from '../server/telegram/telegramUtils';
import { getUserHistory, clearUserHistory, isTelegramBotRunning } from '../server/telegram/telegramBot';

describe('0xAgent Telegram Bot Subsystem', () => {
  it('should escape HTML characters properly', () => {
    assert.equal(escapeHtml('Hello <world> & "friends"'), 'Hello &lt;world&gt; &amp; &quot;friends&quot;');
  });

  it('should convert markdown bold, italic, code, and blockquotes to Telegram HTML', () => {
    const md = `**Bold text** and *italic text* and \`inline_code()\`\n\n> Blockquote line`;
    const html = markdownToTelegramHtml(md);
    assert.ok(html.includes('<b>Bold text</b>'));
    assert.ok(html.includes('<i>italic text</i>'));
    assert.ok(html.includes('<code>inline_code()</code>'));
    assert.ok(html.includes('<blockquote>Blockquote line</blockquote>'));
  });

  it('should split long messages into balanced chunks under limit', () => {
    const longText = 'A'.repeat(5000);
    const chunks = splitHtmlIntoBalancedChunks(longText, 3900);
    assert.ok(chunks.length >= 2);
    for (const chunk of chunks) {
      assert.ok(chunk.length <= 3900);
    }
  });

  it('should manage multi-turn history per user and clear on reset', () => {
    const testUserId = 12345678;
    clearUserHistory(testUserId);
    const history = getUserHistory(testUserId);
    assert.equal(history.length, 1);
    assert.equal(history[0].role, 'system');

    history.push({ role: 'user', content: 'Привет' });
    history.push({ role: 'assistant', content: 'Здравствуйте!' });
    assert.equal(getUserHistory(testUserId).length, 3);

    clearUserHistory(testUserId);
    assert.equal(getUserHistory(testUserId).length, 1);
  });

  it('should report false for bot running if not initialized with valid token', () => {
    assert.equal(isTelegramBotRunning(), false);
  });
});
