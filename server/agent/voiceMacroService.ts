import { spawn, exec } from 'node:child_process';

export interface MacroResult {
  handled: boolean;
  action: string;
  description: string;
}

export class VoiceMacroService {
  /**
   * Evaluates text command against Windows system voice macros.
   * Returns handled=true if executed directly, false if should pass to AI agent.
   */
  public processCommand(text: string): MacroResult {
    if (!text || !text.trim()) {
      return { handled: false, action: '', description: '' };
    }

    const t = text.toLowerCase().trim().replace(/[.,!?-]/g, '');

    // 1. Media Controls (Play / Pause / Next / Prev)
    if (
      t.includes('пауза') ||
      t.includes('паузу') ||
      t.includes('поставь на паузу') ||
      t.includes('продолжи трек') ||
      t.includes('включи трек') ||
      t.includes('включи музыку') ||
      t.includes('останови музыку') ||
      t.includes('плей') ||
      t.includes('играй')
    ) {
      this.sendKey(0xb3); // VK_MEDIA_PLAY_PAUSE
      return { handled: true, action: 'media_play_pause', description: 'Медиа: Воспроизведение / Пауза' };
    }

    if (t.includes('следующий трек') || t.includes('следующая песня') || t.includes('следующий')) {
      this.sendKey(0xb5); // VK_MEDIA_NEXT_TRACK
      return { handled: true, action: 'media_next', description: 'Медиа: Следующий трек' };
    }

    if (t.includes('предыдущий трек') || t.includes('предыдущая песня') || t.includes('назад трек')) {
      this.sendKey(0xb6); // VK_MEDIA_PREV_TRACK
      return { handled: true, action: 'media_prev', description: 'Медиа: Предыдущий трек' };
    }

    // 2. Volume Controls
    if (t.includes('громче') || t.includes('прибавь звук') || t.includes('добавь звук') || t.includes('увеличь громкость')) {
      this.sendKeyRepeated(0xaf, 5); // VK_VOLUME_UP
      return { handled: true, action: 'vol_up', description: 'Громкость: +10%' };
    }

    if (t.includes('тише') || t.includes('убавь звук') || t.includes('уменьши звук') || t.includes('сделай тише')) {
      this.sendKeyRepeated(0xae, 5); // VK_VOLUME_DOWN
      return { handled: true, action: 'vol_down', description: 'Громкость: -10%' };
    }

    if (t.includes('выключи звук') || t.includes('без звука') || t.includes('заглуши') || t.includes('мьют') || t.includes('муте')) {
      this.sendKey(0xad); // VK_VOLUME_MUTE
      return { handled: true, action: 'vol_mute', description: 'Громкость: Вкл/Выкл Mute' };
    }

    // 3. Window & Desktop Management
    if (t.includes('сверни все окна') || t.includes('свернуть все окна') || t.includes('покажи рабочий стол') || t.includes('чистый стол')) {
      exec('powershell -NoProfile -Command "(New-Object -ComObject Shell.Application).MinimizeAll()"');
      return { handled: true, action: 'minimize_all', description: 'Рабочий стол: Свернуть все окна' };
    }

    if (t.includes('восстанови все окна') || t.includes('верни окна') || t.includes('разверни окна')) {
      exec('powershell -NoProfile -Command "(New-Object -ComObject Shell.Application).UndoMinimizeALL()"');
      return { handled: true, action: 'restore_all', description: 'Рабочий стол: Развернуть окна' };
    }

    if (t.includes('заблокируй компьютер') || t.includes('заблокируй пк') || t.includes('заблокируй экран')) {
      exec('rundll32.exe user32.dll,LockWorkStation');
      return { handled: true, action: 'lock_pc', description: 'Безопасность: Блокировка ПК' };
    }

    // 4. App Launchers
    if (t.startsWith('открой') || t.startsWith('запусти')) {
      const app = t.replace(/^(открой|запусти)\s+/, '').trim();
      if (app === 'код' || app === 'вскод' || app === 'vscode' || app === 'vs code') {
        spawn('code', [], { detached: true, stdio: 'ignore' });
        return { handled: true, action: 'launch_code', description: 'Запуск VS Code' };
      }
      if (app === 'хром' || app === 'браузер' || app === 'chrome') {
        spawn('cmd', ['/c', 'start', 'chrome'], { detached: true, stdio: 'ignore' });
        return { handled: true, action: 'launch_chrome', description: 'Запуск Google Chrome' };
      }
      if (app === 'телеграм' || app === 'телегу' || app === 'telegram') {
        spawn('cmd', ['/c', 'start', 'tg://'], { detached: true, stdio: 'ignore' });
        return { handled: true, action: 'launch_telegram', description: 'Запуск Telegram' };
      }
      if (app === 'калькулятор' || app === 'calc') {
        spawn('calc', [], { detached: true, stdio: 'ignore' });
        return { handled: true, action: 'launch_calc', description: 'Запуск Калькулятора' };
      }
      if (app === 'проводник' || app === 'папки' || app === 'файлы') {
        spawn('explorer', [], { detached: true, stdio: 'ignore' });
        return { handled: true, action: 'launch_explorer', description: 'Запуск Проводника' };
      }
      if (app === 'терминал' || app === 'консоль') {
        spawn('cmd', ['/c', 'start', 'powershell'], { detached: true, stdio: 'ignore' });
        return { handled: true, action: 'launch_terminal', description: 'Запуск Терминала' };
      }
    }

    return { handled: false, action: '', description: '' };
  }

  private sendKey(vkCode: number) {
    const py = `import ctypes; ctypes.windll.user32.keybd_event(${vkCode}, 0, 0, 0); ctypes.windll.user32.keybd_event(${vkCode}, 0, 2, 0)`;
    spawn('python', ['-c', py], { stdio: 'ignore', detached: true });
  }

  private sendKeyRepeated(vkCode: number, count: number) {
    const py = `import ctypes, time
for _ in range(${count}):
    ctypes.windll.user32.keybd_event(${vkCode}, 0, 0, 0)
    ctypes.windll.user32.keybd_event(${vkCode}, 0, 2, 0)
    time.sleep(0.05)
`;
    spawn('python', ['-c', py], { stdio: 'ignore', detached: true });
  }
}

export const voiceMacroService = new VoiceMacroService();
