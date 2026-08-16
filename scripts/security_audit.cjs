const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const IGNORE_DIRS = new Set(['.git', 'node_modules', 'dist', 'models', 'logs', '__pycache__', '.pytest_cache']);
const IGNORE_EXTS = new Set(['.png', '.jpg', '.jpeg', '.ico', '.gguf', '.exe', '.tsbuildinfo', '.zip', '.tar', '.gz', '.pyc', '.pyo']);

const PATTERNS = [
  { name: 'Google API Key', regex: /AIza[0-9A-Za-z-_]{35}/g },
  { name: 'OpenAI Secret Key', regex: /sk-[a-zA-Z0-9]{20,}/g },
  { name: 'GitHub Token', regex: /ghp_[a-zA-Z0-9]{20,}/g },
  { name: 'Generic Secret Assignment', regex: /(?:api_?key|secret|auth_?token|password)\s*[:=]\s*["'][a-zA-Z0-9_\-]{8,}["']/gi },
  { name: 'Hardcoded User Path', regex: /[a-zA-Z]:[\\\/]Users[\\\/][a-zA-Z0-9_.-]+/gi },
  { name: 'Personal IPv4 / Host', regex: /(?:192\.168\.\d+\.\d+|10\.\d+\.\d+\.\d+|172\.(?:1[6-9]|2\d|3[01])\.\d+\.\d+)/g },
];

const findings = [];

function scanDir(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    if (IGNORE_DIRS.has(entry.name)) continue;
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      scanDir(fullPath);
    } else if (entry.isFile()) {
      const ext = path.extname(entry.name).toLowerCase();
      if (IGNORE_EXTS.has(ext)) continue;
      if (entry.name === 'package-lock.json') continue;
      if (entry.name === 'security_audit.js') continue;
      
      const relPath = path.relative(ROOT, fullPath);
      try {
        const content = fs.readFileSync(fullPath, 'utf8');
        const lines = content.split(/\r?\n/);
        lines.forEach((line, idx) => {
          for (const pattern of PATTERNS) {
            let match;
            pattern.regex.lastIndex = 0;
            while ((match = pattern.regex.exec(line)) !== null) {
              findings.push({
                file: relPath,
                line: idx + 1,
                type: pattern.name,
                match: match[0],
                snippet: line.trim()
              });
            }
          }
        });
      } catch (err) {
        console.error(`Error reading ${relPath}:`, err.message);
      }
    }
  }
}

scanDir(ROOT);
console.log(JSON.stringify(findings, null, 2));
