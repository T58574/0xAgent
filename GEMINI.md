# GEMINI.md — 0xAgent Quick Reference

## 🚀 Проект
**0xAgent** — автономия и веб-IDE интерфейс локального ИИ-агента (React 19 + Node.js/Express + llama.cpp).

---

## 📁 Структура и Ключевые Файлы

### Backend (`server/`)
- `index.ts` — Главный сервер Express (порты `3001` API, WS `/ws`), управление процессом `llama-server.exe`.
- `agent.ts` — Цикл ИИ-агента (парсер промптов, вызов инструментов, стриминг токенов).
- `tools.ts` — Исполнитель инструментов (чтение/запись файлов, патчи, поиск, вызов терминала).
- `config.ts` — Загрузка и сохранение настроек (`~/.0xagent/config.json`).
- `session.ts` — Хранение и управление сессиями чатов.
- `hardware.ts` — Автодетект GPU / VRAM (Win32_VideoController).
- `ggufParser.ts` — Парсер бинарных GGUF заголовков моделей.

### Frontend (`src/`)
- `App.tsx` — Главный компонент, WS-подписки, роутинг видов, сплит-скрин.
- `components/Navbar.tsx` — Верхняя панель: статус LLM-сервера, переключатель видов (Чат, Редактор, Настройки, Аналитика).
- `components/Sidebar.tsx` — Боковое меню сессий чата и дерева файлов.
- `components/ChatArea.tsx` — Окно чата, ход мыслей `<think>`, фоновый суммаризатор, карточки инструментов.
- `components/CodeEditor.tsx` — Вкладки файлов и встроенный просмотр кода.
- `components/settings/` — Раздел настроек (Основные, LLM Сервер, Личности/Personas, Темы, Безопасность).
- `services/api.ts` — REST API & WebSocket клиент.
- `index.css` — Стекломорфизм и 4 темы оформления (`obsidian`, `cyber`, `graphite`, `matrix`).

### Директория Данных (`~/.0xagent/`)
- `config.json` — Настройки приложения.
- `data/sessions/` — История сессий чата в JSON.
- `llama/` — Исполняемые бинарники `llama.cpp`.
- `models/` — Файлы моделей `.gguf`.
- `memory.json` / `skills/` — Память и инструкции скиллов.

---

## 🛠 Команды Разработки
- `npm run dev` — Одновременный запуск бэкенда (`:3001`) и фронтенда Vite (`:5173`).
- `npm run build` — TypeScript проверщик (`tsc`) + Vite сборщик.
- `npm run stop` — Очистка зависших процессов и портов (`cleanup.ps1`).
