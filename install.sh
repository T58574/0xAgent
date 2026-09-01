#!/usr/bin/env bash
# 0xAgent 1-Click Universal Unix/macOS/Linux Installer & CLI Setup
# Usage: curl -fsSL https://raw.githubusercontent.com/T58574/0xAgent/main/install.sh | bash

set -e

CYAN='\033[0;36m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
GRAY='\033[0;90m'
NC='\033[0m'

OX_DIR="$HOME/.0xagent"
APP_DIR="$OX_DIR/app"
BIN_DIR="$OX_DIR/bin"
LOG_FILE="$OX_DIR/install.log"
REPO_URL="https://github.com/T58574/0xAgent.git"

mkdir -p "$OX_DIR" "$BIN_DIR" "$OX_DIR/models" "$OX_DIR/llama"

log() {
    local msg="[$(date '+%Y-%m-%d %H:%M:%S')] $1"
    echo "$msg" >> "$LOG_FILE" 2>/dev/null || true
}

safe_exit() {
    local err_msg="$1"
    local help_url="$2"
    echo -e "\n${RED}================================================================${NC}"
    echo -e "${RED}[!] INSTALLATION FAILED${NC}"
    echo -e "${RED}================================================================${NC}"
    echo -e "${YELLOW}[ERR] $err_msg${NC}"
    if [ -n "$help_url" ]; then
        echo -e "${CYAN}[LINK] $help_url${NC}"
    fi
    echo -e "${GRAY}Detailed log: $LOG_FILE${NC}\n"
    log "INSTALLATION FAILED: $err_msg"
    exit 1
}

trap 'if [ $? -ne 0 ]; then safe_exit "Script interrupted or failed unexpectedly." "https://github.com/T58574/0xAgent"; fi' EXIT

echo -e "${CYAN}================================================================${NC}"
echo -e "${CYAN}|   0xAgent — Autonomous AI Developer & Web-IDE Platform       |${NC}"
echo -e "${CYAN}|   1-Click Interactive Unix/macOS Installer & CLI Hub         |${NC}"
echo -e "${CYAN}================================================================${NC}\n"

log "0xAgent installation started."

if [ -f "package.json" ] && grep -q '"name": "0xagent"' "package.json" 2>/dev/null; then
    APP_DIR="$(pwd)"
    echo -e "${GREEN}[+] Detected local 0xAgent workspace at: $APP_DIR${NC}"
    log "Using local workspace at $APP_DIR"
fi

# 1. Prerequisites Check
echo -e "${YELLOW}[1/5] Verifying System Prerequisites...${NC}"

if ! command -v git &> /dev/null; then
    echo -e "${RED}[!] Git is not installed.${NC}"
    echo -e "    Git is required to download 0xAgent and manage automatic updates."
    echo -e "    - macOS: brew install git"
    echo -e "    - Ubuntu/Debian: sudo apt update && sudo apt install -y git"
    echo -e "    - Arch Linux: sudo pacman -S git"
    safe_exit "Git is required to install 0xAgent." "https://git-scm.com/download"
fi
echo -e "${GREEN}[OK] Git is available: $(git --version)${NC}"

if ! command -v node &> /dev/null; then
    echo -e "${RED}[!] Node.js is not installed.${NC}"
    echo -e "    Node.js (>= 24.0.0) is required to run the 0xAgent runtime."
    echo -e "    - macOS: brew install node@24"
    echo -e "    - Ubuntu/Debian: curl -fsSL https://deb.nodesource.com/setup_24.x | sudo -E bash - && sudo apt install -y nodejs"
    echo -e "    - NVM: nvm install 24 && nvm use 24"
    echo -e "    - Official: https://nodejs.org/"
    safe_exit "Node.js >= 24.0.0 is required." "https://nodejs.org/"
fi

NODE_MAJOR=$(node -v | sed 's/^v//' | cut -d. -f1)
if [ "$NODE_MAJOR" -lt 24 ]; then
    echo -e "${RED}[!] Detected Node.js $(node -v). 0xAgent requires Node.js >= 24.0.0.${NC}"
    echo -e "    Please upgrade Node.js (e.g. nvm install 24 || brew upgrade node)"
    safe_exit "Outdated Node.js version. Node >= 24 is required." "https://nodejs.org/"
fi
echo -e "${GREEN}[OK] Node.js $(node -v) is available (>=24.0.0).${NC}"


# 2. Clone or Update Codebase
echo -e "\n${YELLOW}[2/5] Synchronizing 0xAgent Codebase...${NC}"
if [ ! -f "$APP_DIR/package.json" ]; then
    echo -e "${CYAN}[+] Cloning repository into: $APP_DIR${NC}"
    git clone "$REPO_URL" "$APP_DIR" || safe_exit "Failed to clone repository from GitHub." "$REPO_URL"
else
    echo -e "${CYAN}[+] Existing installation found. Updating to latest version...${NC}"
    cd "$APP_DIR"
    git fetch origin main 2>/dev/null && git pull --rebase origin main 2>/dev/null || true
fi

# 3. Dependencies
echo -e "\n${YELLOW}[3/5] Installing Dependencies (npm install)...${NC}"
cd "$APP_DIR"
npm install --no-audit --no-fund || {
    echo -e "${YELLOW}[!] Retrying npm install...${NC}"
    npm install || safe_exit "npm install failed." "https://github.com/T58574/0xAgent"
}
echo -e "${GREEN}[OK] Dependencies installed.${NC}"

# 4. Build Client & Certificates
echo -e "\n${YELLOW}[4/5] Building Production Client & Generating SSL...${NC}"
node ./scripts/ensure-ssl.cjs || true
npm run build || echo -e "${YELLOW}[WARN] Production build warning. Dev server available.${NC}"

# 5. Link Global CLI Command
echo -e "\n${YELLOW}[5/5] Linking Global '0xagent' CLI...${NC}"
chmod +x "$APP_DIR/bin/0xagent.js"
ln -sf "$APP_DIR/bin/0xagent.js" "$BIN_DIR/0xagent"

# Add to PATH in shell profile
SHELL_RC=""
if [ -n "$ZSH_VERSION" ] || [ "$SHELL" = "/bin/zsh" ]; then
    SHELL_RC="$HOME/.zshrc"
elif [ -f "$HOME/.bashrc" ]; then
    SHELL_RC="$HOME/.bashrc"
elif [ -f "$HOME/.profile" ]; then
    SHELL_RC="$HOME/.profile"
fi

if [ -n "$SHELL_RC" ] && [ -f "$SHELL_RC" ]; then
    if ! grep -q "$BIN_DIR" "$SHELL_RC"; then
        echo "export PATH=\"\$PATH:$BIN_DIR\"" >> "$SHELL_RC"
        echo -e "${GREEN}[+] Added $BIN_DIR to $SHELL_RC${NC}"
    fi
fi

# Disable trap for clean success exit
trap - EXIT

echo -e "\n${GREEN}================================================================${NC}"
echo -e "${GREEN}[SUCCESS] 0xAgent has been successfully installed!${NC}"
echo -e "${GREEN}================================================================${NC}\n"
echo -e "${CYAN}Available CLI Commands:${NC}"
echo -e "  0xagent              Start 0xAgent platform"
echo -e "  0xagent config       Interactive settings & models manager"
echo -e "  0xagent update       Pull latest updates from GitHub"
echo -e "  0xagent status       Check backend health & active models"
echo -e "  0xagent stop         Terminate running platform processes"
echo -e "  0xagent purge-vram   Release GPU memory\n"
