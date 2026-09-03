import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Ensures Veronica MCP Server is registered in ~/.gemini/config/mcp_config.json
 * Automatically runs on platform boot and update.
 */
export function ensureVeronicaMcpConfig(projectRoot?: string): boolean {
  try {
    const root = projectRoot || path.resolve(__dirname, '..', '..', '..');
    const home = process.env.USERPROFILE || process.env.HOME || os.homedir();
    const configDir = path.join(home, '.gemini', 'config');
    const configFile = path.join(configDir, 'mcp_config.json');

    if (!fs.existsSync(configDir)) {
      fs.mkdirSync(configDir, { recursive: true });
    }

    let mcpJson: Record<string, any> = { mcpServers: {} };
    if (fs.existsSync(configFile)) {
      try {
        const raw = fs.readFileSync(configFile, 'utf8');
        mcpJson = JSON.parse(raw);
        if (!mcpJson.mcpServers || typeof mcpJson.mcpServers !== 'object') {
          mcpJson.mcpServers = {};
        }
      } catch (err: any) {
        console.warn('[Veronica MCP] Warning reading existing mcp_config.json:', err?.message || err);
        mcpJson = { mcpServers: {} };
      }
    }

    const isWin = process.platform === 'win32';
    const mcpScriptPath = path.join(root, 'bin', 'veronica-mcp.js').replace(/\\/g, '/');

    const veronicaConfig = isWin
      ? {
          command: 'cmd.exe',
          args: ['/c', 'node', mcpScriptPath],
        }
      : {
          command: 'node',
          args: [mcpScriptPath],
        };

    const current = mcpJson.mcpServers['veronica'];
    const isUpToDate =
      current &&
      current.command === veronicaConfig.command &&
      JSON.stringify(current.args) === JSON.stringify(veronicaConfig.args);

    if (!isUpToDate) {
      mcpJson.mcpServers['veronica'] = veronicaConfig;
      fs.writeFileSync(configFile, JSON.stringify(mcpJson, null, 2), 'utf8');
      console.log(`[Veronica MCP] [OK] Auto-registered 'veronica' MCP server in ${configFile}`);
    }
    return true;
  } catch (err: any) {
    console.error('[Veronica MCP] [ERR] Failed to auto-register MCP server:', err?.message || err);
    return false;
  }
}
