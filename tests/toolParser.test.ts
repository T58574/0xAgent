import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  parseToolCalls,
  detectToolOutputHallucination,
  stripHallucinatedToolOutput,
} from '../server/agent/toolParser';

describe('Tool Parser Subsystem Test Suite', () => {
  it('should parse read_file from attributes and body formats', () => {
    const textAttr = '<read_file path="src/index.ts" />';
    const calls1 = parseToolCalls(textAttr);
    assert.equal(calls1.length, 1);
    assert.equal(calls1[0].name, 'read_file');
    assert.equal(calls1[0].arguments.path, 'src/index.ts');

    const textBody = '<readfile>{"path": "package.json"}</readfile>';
    const calls2 = parseToolCalls(textBody);
    assert.equal(calls2.length, 1);
    assert.equal(calls2[0].name, 'read_file');
    assert.equal(calls2[0].arguments.path, 'package.json');

    const textRawBody = '<read_file>src/App.tsx</read_file>';
    const calls3 = parseToolCalls(textRawBody);
    assert.equal(calls3.length, 1);
    assert.equal(calls3[0].name, 'read_file');
    assert.equal(calls3[0].arguments.path, 'src/App.tsx');
  });

  it('should parse write_file and unclosed fallback', () => {
    const text1 = '<write_file path="src/test.txt">Hello World</write_file>';
    const calls1 = parseToolCalls(text1);
    assert.equal(calls1.length, 1);
    assert.equal(calls1[0].name, 'write_file');
    assert.equal(calls1[0].arguments.path, 'src/test.txt');
    assert.equal(calls1[0].arguments.content, 'Hello World');

    const textFallback = '<writefile path="out.txt">\nsome content here\n<read_file path="foo.ts"/>';
    const calls2 = parseToolCalls(textFallback);
    assert.equal(calls2.length, 2);
    assert.equal(calls2.some(c => c.name === 'write_file' && c.arguments.path === 'out.txt'), true);
    assert.equal(calls2.some(c => c.name === 'read_file' && c.arguments.path === 'foo.ts'), true);
  });

  it('should parse patch_file and fallback with SEARCH markers', () => {
    const text1 = '<patch_file path="src/App.tsx"><<<<<<< SEARCH\nfoo\n=======\nbar\n>>>>>>> REPLACE</patch_file>';
    const calls1 = parseToolCalls(text1);
    assert.equal(calls1.length, 1);
    assert.equal(calls1[0].name, 'patch_file');
    assert.equal(calls1[0].arguments.path, 'src/App.tsx');
    assert.match(calls1[0].arguments.content, /SEARCH/);

    const textFallback = '<patchfile path="src/App.tsx">\n```ts\n<<<<<<< SEARCH\nfoo\n=======\nbar\n>>>>>>> REPLACE\n```';
    const calls2 = parseToolCalls(textFallback);
    assert.equal(calls2.length, 1);
    assert.equal(calls2[0].name, 'patch_file');
    assert.equal(calls2[0].arguments.path, 'src/App.tsx');
  });

  it('should parse list_dir and grep_search permutations', () => {
    const list1 = '<list_dir path="src" />';
    const listCalls = parseToolCalls(list1);
    assert.equal(listCalls.length, 1);
    assert.equal(listCalls[0].name, 'list_dir');
    assert.equal(listCalls[0].arguments.path, 'src');

    const listEmpty = '<listdir />';
    assert.equal(parseToolCalls(listEmpty)[0].arguments.path, '.');

    const grep1 = '<grep_search pattern="test" path="server" />';
    const grepCalls = parseToolCalls(grep1);
    assert.equal(grepCalls[0].name, 'grep_search');
    assert.equal(grepCalls[0].arguments.pattern, 'test');
    assert.equal(grepCalls[0].arguments.path, 'server');

    const grepInverted = '<grepsearch path="client" pattern="react" />';
    const grepCalls2 = parseToolCalls(grepInverted);
    assert.equal(grepCalls2[0].name, 'grep_search');
    assert.equal(grepCalls2[0].arguments.pattern, 'react');
    assert.equal(grepCalls2[0].arguments.path, 'client');
  });

  it('should parse fff_search, web_search, and read_web_page', () => {
    const fff = '<fff_search query="App.tsx" />';
    assert.equal(parseToolCalls(fff)[0].name, 'fff_search');
    assert.equal(parseToolCalls(fff)[0].arguments.query, 'App.tsx');

    const web = '<web_search query="llama.cpp releases" />';
    assert.equal(parseToolCalls(web)[0].name, 'web_search');
    assert.equal(parseToolCalls(web)[0].arguments.query, 'llama.cpp releases');

    const readWeb = '<read_web_page url="https://github.com" />';
    assert.equal(parseToolCalls(readWeb)[0].name, 'read_web_page');
    assert.equal(parseToolCalls(readWeb)[0].arguments.url, 'https://github.com');
  });

  it('should parse knowledge, persona and profile tools', () => {
    const saveKb = '<save_knowledge title="Architecture" category="system" tags="core,db" summary="Arch overview">System info</save_knowledge>';
    const kbCalls = parseToolCalls(saveKb);
    assert.equal(kbCalls[0].name, 'save_knowledge');
    assert.equal(kbCalls[0].arguments.title, 'Architecture');
    assert.equal(kbCalls[0].arguments.category, 'system');
    assert.deepEqual(kbCalls[0].arguments.tags, ['core', 'db']);
    assert.equal(kbCalls[0].arguments.content, 'System info');

    const profile = '<update_user_profile trait="Prefers TypeScript" category="profile" />';
    const profCalls = parseToolCalls(profile);
    assert.equal(profCalls[0].name, 'update_user_profile');
    assert.equal(profCalls[0].arguments.trait, 'Prefers TypeScript');
    assert.equal(profCalls[0].arguments.category, 'profile');

    const persona = '<update_persona_file file="SOUL.md">Soul content</update_persona_file>';
    const personaCalls = parseToolCalls(persona);
    assert.equal(personaCalls[0].name, 'update_persona_file');
    assert.equal(personaCalls[0].arguments.file, 'SOUL.md');
    assert.equal(personaCalls[0].arguments.content, 'Soul content');
  });

  it('should parse execute_command, code_run, ask_user_question and todo_write', () => {
    const exec = '<execute_command command="npm test" />';
    assert.equal(parseToolCalls(exec)[0].name, 'execute_command');
    assert.equal(parseToolCalls(exec)[0].arguments.command, 'npm test');

    const code = '<code_run script="console.log(1+1)" />';
    assert.equal(parseToolCalls(code)[0].name, 'code_run');
    assert.equal(parseToolCalls(code)[0].arguments.script, 'console.log(1+1)');

    const todo = '<todo_write todos=\'[{"id":"1","text":"Do this","status":"pending"}]\' />';
    const todoCalls = parseToolCalls(todo);
    assert.equal(todoCalls[0].name, 'todo_write');
    assert.equal(todoCalls[0].arguments.todos.length, 1);

    const askQ = '<ask_user_question question="Which port?" options="3000, 3001" />';
    const askCalls = parseToolCalls(askQ);
    assert.equal(askCalls[0].name, 'ask_user_question');
    assert.equal(askCalls[0].arguments.questions[0].question, 'Which port?');
  });

  it('should parse Gemma-style tool calls and malformed JSON fallbacks', () => {
    const gemmaJson = '<tool_call>{"name": "read_file", "arguments": {"path": "src/App.tsx"}}</tool_call>';
    const gemmaCalls1 = parseToolCalls(gemmaJson);
    assert.equal(gemmaCalls1.length, 1);
    assert.equal(gemmaCalls1[0].name, 'read_file');
    assert.equal(gemmaCalls1[0].arguments.path, 'src/App.tsx');

    const gemmaMalformed = '<toolcall>name="grepsearch" pattern="error" path="server"</toolcall>';
    const gemmaCalls2 = parseToolCalls(gemmaMalformed);
    assert.equal(gemmaCalls2.length, 1);
    assert.equal(gemmaCalls2[0].name, 'grep_search');
    assert.equal(gemmaCalls2[0].arguments.pattern, 'error');
    assert.equal(gemmaCalls2[0].arguments.path, 'server');
  });

  it('should ignore tool calls inside thinking and thought blocks', () => {
    const textWithThinking = `
<THINKING>
Let me first consider using:
<code_run>
const [dir, mem] = await Promise.all([tools.list_dir({path: '.'})]);
return {dir, mem};
</code_run>
or maybe:
<read_file path="dummy.txt" />
</THINKING>

Now here is my actual response:
<list_dir path="src" />
`;
    const calls = parseToolCalls(textWithThinking);
    assert.equal(calls.length, 1);
    assert.equal(calls[0].name, 'list_dir');
    assert.equal(calls[0].arguments.path, 'src');
  });

  it('should parse code_run body correctly', () => {
    const text = `
I will now inspect the project.
<code_run>
const [dir, mem] = await Promise.all([
  tools.list_dir({path: '.'}),
  tools.recall_memories({query: 'user goals'})
]);
return {dir, mem};
</code_run>
`;
    const calls = parseToolCalls(text);
    assert.equal(calls.length, 1);
    assert.equal(calls[0].name, 'code_run');
    assert.ok(calls[0].arguments.script.includes('tools.list_dir'));
    assert.ok(calls[0].arguments.code.includes('tools.recall_memories'));
    assert.ok(calls[0].arguments.program.includes('return {dir, mem};'));
  });
});
