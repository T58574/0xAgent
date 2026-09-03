const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');

/**
 * Ensures Veronica MCP Server is registered in ~/.gemini/config/mcp_config.json
 * Automatically invoked on boot, postinstall, build, and platform update.
 */
function ensureMcpConfig(projectRoot = path.resolve(__dirname, '..')) {
  try {
    const home = process.env.USERPROFILE || process.env.HOME || os.homedir();
    const configDir = path.join(home, '.gemini', 'config');
    const configFile = path.join(configDir, 'mcp_config.json');

    if (!fs.existsSync(configDir)) {
      fs.mkdirSync(configDir, { recursive: true });
    }

    let mcpJson = { mcpServers: {} };
    if (fs.existsSync(configFile)) {
      try {
        const raw = fs.readFileSync(configFile, 'utf8');
        mcpJson = JSON.parse(raw);
        if (!mcpJson.mcpServers || typeof mcpJson.mcpServers !== 'object') {
          mcpJson.mcpServers = {};
        }
      } catch (err) {
        console.warn('[MCP Registration] Warning reading existing mcp_config.json:', err.message);
        mcpJson = { mcpServers: {} };
      }
    }

    const isWin = process.platform === 'win32';
    const mcpScriptPath = path.join(projectRoot, 'bin', 'veronica-mcp.js').replace(/\\/g, '/');

    // Production-ready cross-platform MCP Server config
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
      console.log(`[MCP Registration] [OK] Successfully registered 'veronica' MCP server in ${configFile}`);
    } else {
      console.log(`[MCP Registration] [OK] 'veronica' MCP server is up-to-date in ${configFile}`);
    }
    return true;
  } catch (err) {
    console.error('[MCP Registration] [ERR] Failed to ensure MCP configuration:', err);
    return false;
  }
}

if (require.main === module) {
  ensureMcpConfig();
}

module.exports = { ensureMcpConfig };
