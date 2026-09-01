# Модуль «Вероника» (Veronica) — Автономный AI-ассистент и супервизор распределенных агентов

## 🚀 Обзор
**Модуль «Вероника»** — это встроенный в платформу **0xAgent** автономный фоновый супервизор, механизм долговременного состояния (Persistent State Machine) и координатор фоновых агентов (`agy`), работающий 24/7. Модуль выступает командным центром: отслеживает состояние проектов, управляет блокировками, делегирует инференс по локальной сети (LAN GPU Node) и взаимодействует с разработчиком через Telegram.

---

## 🏛 Архитектура и ключевые подсистемы

```mermaid
flowchart TD
    subgraph Trigger ["1. Источники событий"]
        UI["Web UI Дашборд"]
        TG["Telegram Бот (/run, Inline-кнопки)"]
        CRON["Планировщик Cron (@daily, @hourly)"]
    end

    subgraph Core ["2. Ядро Вероники (Супервизор)"]
        TR["Task Registry & Реестр задач"]
        PL["Project Lock Manager (Мьютекс на проект)"]
        CE["Context Engine (< 250 токенов)"]
        WD["Process Watchdog (Heartbeat / Tree-Kill)"]
        DB["SQLite DB (WAL-режим + Миграции)"]
    end

    subgraph Runner ["3. Исполнитель (Worker)"]
        AGY["Headless agy Воркер"]
        CLI["CLI Мост: 0xagent veronica"]
    end

    subgraph RemoteNode ["4. LAN GPU Узел"]
        GPU["Рабочая станция с GPU (llama-server / Ollama)"]
    end

    Trigger --> TR
    TR --> PL
    PL -->|Запуск процесса| AGY
    AGY -->|Инференс API| GPU
    AGY -->|Запрос контекста| CLI
    CLI -->|Сжатая выжимка| CE
    AGY -->|Heartbeat / Отчет| CLI
    CLI --> WD
    TR <--> DB
```

---

## 🔑 Ключевые возможности

### 1. Headless Запуск Агентов (`agy`)
* **Проверенные флаги CLI**:
  ```bash
  agy --print "<prompt>" --dangerously-skip-permissions --output-format json --project "<project>"
  ```
* **Инъекция переменных окружения**:
  - `VERONICA_TASK_ID`: UUID активной задачи.
  - `VERONICA_TASK_TOKEN`: Одноразовый криптографический токен.
  - `VERONICA_PROJECT`: Имя целевого проекта.
  - `VERONICA_API_URL`: Локальный REST эндпоинт моста.

### 2. Сверхплотный контекстный движок (< 250 токенов)
* Вместо повторного чтения всего репозитория агент запрашивает выжимку у Вероники:
  ```bash
  0xagent veronica context <project> --task <id>
  ```
* Результат:
  `PROJECT:0xAgent | AUTONOMY:L2 | RECENT_TASKS:[health_check:completed] | COMMITS:[b0be1d6:"fix telegram"] | RULES:keep_minimal`

### 3. Telegram Шлюз и Согласование Действий (Awaiting Approval)
* **Безопасный HTML-режим**: Полная поддержка форматирования Bot API (`parse_mode: 'HTML'`) с экранированием сущностей.
* **Команды бота**:
  - `/start`, `/help` — Обзор и отображение Telegram ID пользователя.
  - `/status` — Телеметрия, активные задачи, статус LAN GPU ноды.
  - `/projects` — Список и сводка проектов.
  - `/today`, `/yesterday` — Суточный отчет о выполненной работе.
  - `/run <skill> <project>` — Запуск автономного агента.
  - `/kill <task_id>` — Принудительная остановка зависшей задачи.
* **Интерактивные Inline-кнопки**:
  - В статусе `awaiting_approval` бот отправляет кнопки `[✅ Одобрить]` и `[❌ Отклонить]`.
  - Callback Query мгновенно снимает задачу с паузы при нажатии.

### 4. Каталог из 10 Встроенных Навыков (`server/veronica/skills/`)

| Файл навыка | Назначение |
|---|---|
| `code_review.md` | Автоматический аудит читаемости, типизации и качества кода. |
| `security_audit.md` | Поиск SQLi, XSS, RCE, утечек секретов и уязвимостей в пакетах. |
| `health_check.md` | Проверка сборки, компиляции и 100% прохождения тестов. |
| `git_sync.md` | Безопасная синхронизация веток и отслеживание коммитов. |
| `architecture_audit.md` | Анализ модульных границ и циклических зависимостей. |
| `refactoring.md` | Устранение дублирования и мертвого кода под контролем тестов. |
| `test_generator.md` | Автоматическая генерация тестов под `node:test`. |
| `doc_sync.md` | Синхронизация документации между `README.md` и `README.ru.md`. |
| `dependency_updater.md` | Безопасное обновление minor/patch зависимостей. |
| `incident_responder.md` | Анализ стектрейсов сбоев, воспроизведение и создание патчей. |

### 5. Удаленный GPU Узел (Compute Node LAN)
* Позволяет ноутбуку работать 24/7 с минимальным энергопотреблением, делегируя генерацию токенов на основной ПК с мощной видеокартой.
* Настраивается в **Настройки -> Local Server -> Compute Node (LAN)**.

### 6. Отказоустойчивость, Миграции и Бэкапы
* **Миграции БД (`schema_migrations`)**: Инкрементальные патчи структуры SQLite.
* **Суточные бэкапы**: Автоматическое создание копий (`veronica_backup_YYYY-MM-DD.db`) с retention 30 дней и WAL-чекпоинтами.
* **Ротация логов**: Ротация по размеру (`10 MB x 5 архивов`) в `~/.0xagent/veronica/logs/`.
* **Process Watchdog**: Отслеживание heartbeat и рекурсивный Tree-Kill процессов при таймауте (>180с).
* **Восстановление при рестарте**: Очистка мертвых PID и сброс зависших блокировок при перезапуске сервера.

---

## 🛠 Быстрый справочник по CLI Вероники

```bash
0xagent veronica context <project> [--task <id>]   # Получить плотный контекст проекта
0xagent veronica heartbeat --task <id>             # Отправить heartbeat пинг
0xagent veronica report --task <id> --status ...   # Зафиксировать итог задачи
0xagent veronica list                              # Список активных задач
```
