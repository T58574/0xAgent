# Contributing to 0xAgent

First off, thank you for considering contributing to **0xAgent**! It's people like you that make 0xAgent an exceptional open-source tool for the AI developer community.

---

## 🛠️ Development Workflow

1. **Fork & Clone:**
   ```bash
   git clone https://github.com/<your-username>/0xAgent.git
   cd 0xAgent
   ```
2. **Install Dependencies:**
   ```bash
   npm install
   ```
3. **Environment Setup:**
   ```bash
   cp .env.example .env
   ```
4. **Run Local Dev Server:**
   ```bash
   npm run dev
   ```
5. **Verify Security & Build:**
   ```bash
   npm run audit:security
   npm run build
   ```

---

## 🛡️ Coding & Security Guidelines

- **Zero XSS Policy**: Never use `dangerouslySetInnerHTML`. All code highlighting must use tokenized React components.
- **Single Source of Truth**: All TypeScript types shared between backend and frontend must reside in `src/types.ts`.
- **Async Non-Blocking I/O**: Use `fs.promises` for disk access. Never block the Node.js Event Loop with synchronous methods in API routes.
- **Strict OPSEC**: Never commit credentials, private tokens, or personal paths. Run `npm run audit:security` before opening a pull request.

---

## 📬 Pull Request Process

1. Create a feature branch (`git checkout -b feature/my-feature`).
2. Commit your changes following conventional commits (`feat:`, `fix:`, `docs:`, `chore:`).
3. Ensure `npm run build` and `npm run audit:security` pass with zero errors.
4. Push to your branch and submit a Pull Request against `main`.
