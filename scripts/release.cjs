#!/usr/bin/env node

/**
 * 0xAgent Automated Release Helper
 * Usage:
 *   node scripts/release.cjs patch    # 0.1.0 -> 0.1.1
 *   node scripts/release.cjs minor    # 0.1.0 -> 0.2.0
 *   node scripts/release.cjs major    # 0.1.0 -> 1.0.0
 *   node scripts/release.cjs 0.2.5    # Set explicit version
 */

const fs = require('node:fs');
const path = require('node:path');
const { execSync } = require('node:child_process');
const readline = require('node:readline');

const PROJECT_ROOT = path.resolve(__dirname, '..');
const PKG_PATH = path.join(PROJECT_ROOT, 'package.json');

const c = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  cyan: '\x1b[36m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  gray: '\x1b[90m',
};

function banner() {
  console.log(`
${c.cyan}${c.bold}  ==============================================================
  |   0xAgent — Automated Version & Release Publisher          |
  ==============================================================${c.reset}
`);
}

function prompt(question) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => rl.question(question, (ans) => {
    rl.close();
    resolve(ans.trim());
  }));
}

function bumpVersion(current, type) {
  const parts = current.replace(/^v/, '').split('.').map((p) => parseInt(p, 10) || 0);
  let [major, minor, patch] = [parts[0] || 0, parts[1] || 0, parts[2] || 0];

  switch (type.toLowerCase()) {
    case 'patch':
      patch += 1;
      break;
    case 'minor':
      minor += 1;
      patch = 0;
      break;
    case 'major':
      major += 1;
      minor = 0;
      patch = 0;
      break;
    default:
      if (/^\d+\.\d+\.\d+/.test(type)) {
        return type.replace(/^v/, '');
      }
      throw new Error(`Invalid bump type or semver string: ${type}. Use 'patch', 'minor', 'major', or e.g. '0.2.0'`);
  }

  return `${major}.${minor}.${patch}`;
}

async function main() {
  banner();

  const arg = process.argv[2] || 'patch';
  const pkg = JSON.parse(fs.readFileSync(PKG_PATH, 'utf8'));
  const currentVersion = pkg.version || '0.1.0';

  let nextVersion;
  try {
    nextVersion = bumpVersion(currentVersion, arg);
  } catch (err) {
    console.error(`${c.red}[ERR] ${err.message}${c.reset}`);
    process.exit(1);
  }

  const tagName = `v${nextVersion}`;

  console.log(`  Current Version : ${c.yellow}v${currentVersion}${c.reset}`);
  console.log(`  Next Release    : ${c.green}${tagName}${c.reset}\n`);

  // 1. Run Automated Test Verification
  console.log(`${c.yellow}[1/4] Running test suite verification (npm test)...${c.reset}`);
  try {
    execSync('npm test', { cwd: PROJECT_ROOT, stdio: 'inherit' });
    console.log(`${c.green}[OK] All unit and subsystem tests passed.${c.reset}\n`);
  } catch (err) {
    console.error(`\n${c.red}[FAIL] Tests failed! Release aborted to maintain integrity.${c.reset}`);
    process.exit(1);
  }

  // 2. Production Build Check
  console.log(`${c.yellow}[2/4] Verifying production client build (npm run build)...${c.reset}`);
  try {
    execSync('npm run build', { cwd: PROJECT_ROOT, stdio: 'inherit' });
    console.log(`${c.green}[OK] Build successful.${c.reset}\n`);
  } catch (err) {
    console.error(`\n${c.red}[FAIL] Production build failed! Release aborted.${c.reset}`);
    process.exit(1);
  }

  // 3. Update package.json
  console.log(`${c.yellow}[3/4] Bumping package.json to ${nextVersion}...${c.reset}`);
  pkg.version = nextVersion;
  fs.writeFileSync(PKG_PATH, JSON.stringify(pkg, null, 2) + '\n', 'utf8');

  // 4. Git Commit & Tag
  console.log(`${c.yellow}[4/4] Creating Git commit & tag ${tagName}...${c.reset}`);
  try {
    execSync(`git add package.json`, { cwd: PROJECT_ROOT });
    execSync(`git commit -m "chore(release): ${tagName}"`, { cwd: PROJECT_ROOT, stdio: 'inherit' });
    execSync(`git tag -a "${tagName}" -m "Release ${tagName}"`, { cwd: PROJECT_ROOT, stdio: 'inherit' });
    console.log(`${c.green}[OK] Created git commit and tag ${tagName}.${c.reset}\n`);
  } catch (err) {
    console.error(`${c.red}[ERR] Git tagging failed:${c.reset}`, err.message);
    process.exit(1);
  }

  // 5. Ask to push
  console.log(`${c.cyan}==============================================================${c.reset}`);
  console.log(`${c.green}${c.bold}[SUCCESS] Release ${tagName} is prepared!${c.reset}`);
  console.log(`${c.cyan}==============================================================${c.reset}\n`);

  const pushNow = await prompt(`${c.yellow}Push commit & tag to GitHub now to trigger automated release? (Y/n): ${c.reset}`);
  if (pushNow.toLowerCase() !== 'n') {
    console.log(`\n${c.cyan}[*] Pushing to GitHub with tags...${c.reset}`);
    try {
      execSync('git push origin main --follow-tags', { cwd: PROJECT_ROOT, stdio: 'inherit' });
      console.log(`\n${c.green}${c.bold}[DONE] Pushed successfully! GitHub Actions is now publishing ${tagName}.${c.reset}`);
      console.log(`${c.gray}Check progress at: https://github.com/T58574/0xAgent/actions${c.reset}\n`);
    } catch (err) {
      console.error(`${c.red}[ERR] Push failed:${c.reset}`, err.message);
      console.log(`${c.gray}You can manually push later via: git push origin main --follow-tags${c.reset}\n`);
    }
  } else {
    console.log(`${c.gray}Skipped push. Run 'git push origin main --follow-tags' whenever you are ready.${c.reset}\n`);
  }
}

main();
