#!/usr/bin/env bash
# 0xAgent 1-Click Universal Unix/macOS/Linux Installer & CLI Setup
# Usage: curl -fsSL https://raw.githubusercontent.com/T58574/0xAgent/main/install.sh | bash

set -e

CYAN='\033[0;36m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${CYAN}================================================================${NC}"
echo -e "${CYAN}|   0xAgent — Autonomous AI Developer & Web-IDE Platform       |${NC}"
echo -e "${CYAN}|   1-Click Interactive Unix/macOS Installer & CLI Hub         |${NC}"
echo -e "${CYAN}================================================================${NC}\n"

OX_DIR="$HOME/.0xagent"
APP_DIR="$OX_DIR/app"
BIN_DIR="$OX_DIR/bin"
REPO_URL="https://github.com/T58574/0xAgent.git"

if [ -f "package.json" ] && grep -q '"name": "0xagent"' "package.json" 2>/dev/null; then
    APP_DIR="$(pwd)"
    echo -e "${GREEN}[+] Detected local 0xAgent workspace at: $APP_DIR${NC}"
fi

mkdir -p "$OX_DIR" "$BIN_DIR" "$OX_DIR/models" "$OX_DIR/llama"

# 1. Prerequisites Check
echo -e "${YELLOW}[1/5] Verifying System Prerequisites...${NC}"
if ! command -v git &> /dev/null; then
    echo -e "${RED}[ERR] Git is required. Please install git and re-run installer.${NC}"
    exit 1
fi
if ! command -v node &> /dev/null; then
    echo -e "${RED}[ERR] Node.js (>=20) is required. Please install Node.js and re-run installer.${NC}"
    exit 1
fi
echo -e "${GREEN}[OK] Git and Node.js detected.${NC}"

# 2. Clone or Update Codebase
echo -e "\n${YELLOW}[2/5] Synchronizing 0xAgent Codebase...${NC}"
if [ ! -f "$APP_DIR/package.json" ]; then
    echo -e "${CYAN}[+] Cloning repository into: $APP_DIR${NC}"
    git clone "$REPO_URL" "$APP_DIR"
else
    echo -e "${CYAN}[+] Existing installation found. Updating...${NC}"
    cd "$APP_DIR" && git fetch origin main && git pull --rebase origin main || true
fi

# 3. Dependencies
echo -e "\n${YELLOW}[3/5] Installing Dependencies (npm install)...${NC}"
cd "$APP_DIR"
npm install --no-audit --no-fund

# 4. Build Client & Certificates
echo -e "\n${YELLOW}[4/5] Building Production Client & Generating SSL...${NC}"
node ./scripts/ensure-ssl.cjs
npm run build

# 5. Link Global CLI Command
echo -e "\n${YELLOW}[5/5] Linking Global '0xagent' CLI...${NC}"
chmod +x "$APP_DIR/bin/0xagent.js"
ln -sf "$APP_DIR/bin/0xagent.js" "$BIN_DIR/0xagent"

# Add to PATH in bashrc / zshrc
SHELL_RC=""
if [ -n "$ZSH_VERSION" ] || [ "$SHELL" = "/bin/zsh" ]; then
    SHELL_RC="$HOME/.zshrc"
elif [ -f "$HOME/.bashrc" ]; then
    SHELL_RC="$HOME/.bashrc"
fi

if [ -n "$SHELL_RC" ] && [ -f "$SHELL_RC" ]; then
    if ! grep -q "$BIN_DIR" "$SHELL_RC"; then
        echo "export PATH=\"\$PATH:$BIN_DIR\"" >> "$SHELL_RC"
        echo -e "${GREEN}[+] Added $BIN_DIR to $SHELL_RC${NC}"
    fi
fi

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
