const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');

/**
 * Veronica Model Context Protocol (MCP) Registration Helper (No-op in 100% Local-First Mode)
 */
function ensureMcpConfig(_projectRoot) {
  return true;
}

if (require.main === module) {
  ensureMcpConfig();
}

module.exports = { ensureMcpConfig };

