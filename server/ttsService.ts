import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import { spawn } from 'node:child_process';
import { TtsConfig } from '../src/types';
import { logger } from './logger';
import { voiceDaemonManager } from './agent/voiceDaemonManager';

const APP_DIR = path.join(os.homedir(), '.0xagent');
const CACHE_DIR = path.join(APP_DIR, 'data', 'audio_cache', 'tts');
const VOICE2TEXT_CACHE = path.join(
  os.homedir(),
  'Documents',
  'dev',
  '0xVoice2Text',
  'data',
  'audio_cache',
  'tts'
);

export const PRESET_PHRASES: Record<string, string[]> = {
  greeting: [
    'На связи, сэр.',
    'Системы активны и откалиброваны.',
    'Слушаю вас, сэр.',
    'Я здесь, сэр. Все контуры в норме.',
    'Джарвис на связи. Готов к работе.',
    'Добро пожаловать в мастерскую.',
    'Все модули развернуты, сэр.',
    'Системы в полной готовности.',
  ],
  listening: [
    'Слушаю вас, сэр.',
    'Да, сэр, слушаю внимательно.',
    'На связи. Принимаю команду.',
    'Слушаю ваши указания.',
    'Готов к приему информации.',
    'Слушаю.',
    'Я вас слушаю.',
    'Прием, сэр.',
    'Внимательно слушаю.',
    'Команда принята к прослушиванию.',
  ],
  spark_ready: [
    'Сэр, у меня появилась свежая мысль.',
    'Появилась интересная идея по архитектуре.',
    'Загляните в экран, когда будет минутка.',
    'Я набросал быстрый черновик решения.',
    'Сэр, есть предложение по коду.',
    'Подготовил небольшое улучшение в один клик.',
    'Есть мысль, как упростить этот модуль.',
    'Сформировал короткое предложение для вас.',
    'Взгляните, когда освободитесь.',
    'У меня готов аккуратный план действий.',
  ],
  macro: [
    'Выполняю команду, сэр.',
    'Есть, выполняю.',
    'Принято.',
    'Команда выполнена.',
    'Сделано, сэр.',
    'Запрос активирован.',
  ],
  companion_calm: [
    'Отдыхайте, сэр, я на страже.',
    'Если лежите — отдыхайте, я пока послежу за фоном.',
    'Никакой спешки, двигаемся в вашем темпе.',
    'Я здесь, когда понадоблюсь.',
    'Всё под контролем, системы стабильны.',
    'Не переживайте, фоновые задачи выполняются.',
    'Перерыв — тоже часть рабочего процесса.',
    'Спокойно восстанавливайте силы, сэр.',
    'Я мониторю окружение. Отдыхайте.',
    'Все процессы идут штатно.',
  ],
  gaming_momentum: [
    'Сэр, хорошая катка. Как освободитесь — сделаем один быстрый шаг?',
    'Пока вы отдыхаете, я подготовил микро-задачу на две минуты.',
    'Когда закончите раунд — взгляните на карточку.',
    'Один клик после игры — и проект продвинется дальше.',
    'Сэр, отличный бой. Я пока собрал свежие тесты.',
    'Отвлекитесь на секунду, подтвердите действие — и дальше в игру.',
    'Сделаем быстрый коммит между матчами?',
    'Маленький шаг держит проект живым, сэр.',
  ],
  coding_flow: [
    'Отличный темп, сэр. Продолжаем.',
    'Патч скомпилирован без замечаний.',
    'Логика выстроена безупречно.',
    'Синхронизирую изменения с репозиторием.',
    'Контекст чист, архитектура держится.',
    'Все тесты зеленые, двигаемся дальше.',
    'Файл сохранен, сборка прошла штатно.',
    'Чистый код, сэр.',
  ],
  late_night: [
    'Позднее время, сэр. Не забывайте про сон.',
    'Ночная смена в мастерской. Я на связи.',
    'Энергия на исходе, сэр. Может, короткий перерыв?',
    'Ночной режим активирован. Я держу контроль.',
    'Если устали — ложитесь, я завершу фоновые тесты.',
    'Пора беречь силы, сэр.',
  ],
  success: [
    'Готово, сэр.',
    'Патч успешно применен.',
    'Выполнено в лучшем виде.',
    'Сделано, сэр.',
    'Код обновлен и протестирован.',
    'Операция завершена без ошибок.',
    'Все проверки пройдены.',
    'Принято и реализовано.',
    'Готово, результат на экране.',
    'Задача закрыта.',
  ],
  error: [
    'Возникла небольшая ошибка, проверяю.',
    'Сбой операции, сэр. Локализую причину.',
    'Требуется небольшая корректировка.',
    'Зафиксировано исключение в модуле.',
    'Сэр, обнаружен баг, перехватываю логи.',
    'Не удалось выполнить команду, анализирую.',
    'Ошибка перехвачена, сформировал карточку.',
    'Временный сбой, системы восстанавливаются.',
  ],
  background_task: [
    'Запускаю фоновый анализ.',
    'Тестирую код в ветке дев.',
    'Изучаю структуру проекта.',
    'Проверяю репозиторий.',
    'Запускаю проверку типов TypeScript.',
    'Компилирую модули в фоновом режиме.',
    'Супервизор сканирует окружение.',
    'Синхронизирую данные с облаком.',
  ],
  processing: [
    'Обрабатываю запрос, сэр.',
    'Секунду, рассчитываю модель.',
    'Распознаю аудио поток.',
    'Формирую ответ.',
    'Анализирую контекст.',
    'Генерирую патч.',
  ],
};

export function getPhraseFilename(
  phrase: string,
  voice = 'ru-RU-DmitryNeural',
  rate = '+15%'
): string {
  const hash = crypto
    .createHash('md5')
    .update(`${voice}_${rate}_${phrase}`)
    .digest('hex')
    .slice(0, 10);
  return `tts_${hash}.mp3`;
}

export class TtsService {
  private cacheDir: string;
  private isSpeakingFlag = false;
  private isMutedFlag = process.env.NODE_ENV === 'test' || process.env.npm_lifecycle_event === 'test';
  private wsBroadcaster: ((event: string, data: any) => void) | null = null;
  private currentProcess: any = null;

  constructor() {
    this.cacheDir = CACHE_DIR;
    this.ensureDirectories();
    this.importExternalCache();
    this.startBackgroundPrecaching();
  }

  public setMuted(muted: boolean) {
    this.isMutedFlag = muted;
  }

  public isMuted(): boolean {
    return this.isMutedFlag;
  }

  public setWsBroadcaster(broadcaster: (event: string, data: any) => void) {
    this.wsBroadcaster = broadcaster;
  }

  private ensureDirectories() {
    try {
      if (!fs.existsSync(this.cacheDir)) {
        fs.mkdirSync(this.cacheDir, { recursive: true });
      }
    } catch (err: any) {
      logger.error('TtsService', `Failed to create cache directory: ${err?.message || err}`);
    }
  }

  private importExternalCache() {
    try {
      if (fs.existsSync(VOICE2TEXT_CACHE)) {
        const files = fs.readdirSync(VOICE2TEXT_CACHE);
        let copied = 0;
        for (const file of files) {
          if (file.endsWith('.mp3')) {
            const dest = path.join(this.cacheDir, file);
            if (!fs.existsSync(dest)) {
              fs.copyFileSync(path.join(VOICE2TEXT_CACHE, file), dest);
              copied++;
            }
          }
        }
        if (copied > 0) {
          logger.info('TtsService', `Imported ${copied} cached audio files from 0xVoice2Text.`);
        }
      }
    } catch (err: any) {
      logger.warn('TtsService', `Cache import skipped: ${err?.message || err}`);
    }
  }

  public isSpeaking(): boolean {
    return this.isSpeakingFlag;
  }

  public async speakText(
    text: string,
    options?: {
      voice?: string;
      rate?: string;
      pitch?: string;
      playOnSpeaker?: boolean;
      config?: TtsConfig | null;
      category?: string;
    }
  ): Promise<{ success: boolean; audioBase64?: string; cached: boolean; phrase: string }> {
    if (!text || !text.trim()) {
      return { success: false, cached: false, phrase: text };
    }

    const voice = options?.voice || options?.config?.voice || 'ru-RU-DmitryNeural';
    const rate = options?.rate || options?.config?.rate || '+15%';
    const pitch =
      options?.pitch ||
      options?.config?.pitch ||
      (voice.includes('Dmitry') ? '-5Hz' : '+0Hz');
    const playOnSpeaker =
      !this.isMutedFlag && (options?.playOnSpeaker ?? options?.config?.play_on_speaker ?? true);

    const filename = getPhraseFilename(text.trim(), voice, rate);
    const filePath = path.join(this.cacheDir, filename);

    let isCached = fs.existsSync(filePath);

    if (!isCached) {
      const generated = await this.synthesizeToDisk(text.trim(), filePath, voice, rate, pitch);
      if (!generated) {
        return { success: false, cached: false, phrase: text };
      }
      isCached = true;
    }

    let audioBase64 = '';
    try {
      const buffer = fs.readFileSync(filePath);
      audioBase64 = `data:audio/mp3;base64,${buffer.toString('base64')}`;
    } catch {
      // Base64 conversion non-critical
    }

    // Broadcast to WebSocket clients for browser playback & UI wave indicator
    if (this.wsBroadcaster) {
      this.wsBroadcaster('jarvis_speak', {
        text: text.trim(),
        audioBase64,
        category: options?.category,
        timestamp: Date.now(),
      });
    }

    if (playOnSpeaker && isCached) {
      this.playLocalMp3(filePath);
    }

    return {
      success: true,
      audioBase64,
      cached: isCached,
      phrase: text.trim(),
    };
  }

  public async playCategory(
    category: string,
    config?: TtsConfig | null
  ): Promise<string | null> {
    const list = PRESET_PHRASES[category];
    if (!list || list.length === 0) return null;

    const phrase = list[Math.floor(Math.random() * list.length)];
    await this.speakText(phrase, { config, category });
    return phrase;
  }

  private synthesizeToDisk(
    text: string,
    destPath: string,
    voice: string,
    rate: string,
    pitch: string
  ): Promise<boolean> {
    return new Promise((resolve) => {
      const pyScript = `
import edge_tts
import asyncio
import sys

async def run():
    try:
        comm = edge_tts.Communicate(sys.argv[1], voice=sys.argv[2], rate=sys.argv[3], pitch=sys.argv[4])
        await comm.save(sys.argv[5])
        print("OK")
    except Exception as e:
        print(f"ERR: {e}", file=sys.stderr)
        sys.exit(1)

asyncio.run(run())
      `.trim();

      const proc = spawn(
        'python',
        ['-c', pyScript, text, voice, rate, pitch, destPath],
        { stdio: ['ignore', 'pipe', 'pipe'] }
      );

      proc.on('close', (code) => {
        if (code === 0 && fs.existsSync(destPath)) {
          resolve(true);
        } else {
          logger.warn('TtsService', `Edge-TTS synthesis failed for "${text}" (code: ${code})`);
          resolve(false);
        }
      });

      proc.on('error', (err) => {
        logger.error('TtsService', `Failed to spawn python for TTS: ${err?.message || err}`);
        resolve(false);
      });
    });
  }

  public cleanLeadingJarvisPhrase(rawText: string): { cleanText: string; isOnlyGreeting: boolean } {
    if (!rawText || !rawText.trim()) {
      return { cleanText: '', isOnlyGreeting: true };
    }

    let text = rawText.trim();

    const greetings = [
      'слушаю вас, сэр',
      'слушаю вас сэр',
      'слушаю вас',
      'да, сэр',
      'да сэр',
      'на связи',
      'я вас слушаю',
      'внимательно слушаю',
      'прием, сэр',
      'прием сэр',
      'готов к приему информации',
      'команда принята к прослушиванию',
      'слушаю',
      'джарвис',
      'джарвиз',
      'жарвис',
      'эй джарвис',
    ];

    for (const g of greetings) {
      try {
        const escaped = g.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&');
        const reg = new RegExp(`^${escaped}[\\s,.:;!?-]*`, 'i');
        if (reg.test(text)) {
          text = text.replace(reg, '').trim();
        }
      } catch {}
    }

    const stopWords = ['стоп', 'стопнули', 'хватит', 'отмена', 'отбой', 'пауза'];
    for (const sw of stopWords) {
      try {
        const escaped = sw.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&');
        const regStop = new RegExp(`[\\s,.:;!?-]+${escaped}[\\s,.:;!?-]*$`, 'i');
        text = text.replace(regStop, '').trim();
      } catch {}
    }

    return {
      cleanText: text,
      isOnlyGreeting: text.length === 0,
    };
  }

  private playLocalMp3(filePath: string) {
    this.stopLocalPlayback();
    this.isSpeakingFlag = true;
    voiceDaemonManager.notifyTtsSpeaking(true);

    const playScript = `
import ctypes
import sys
import time

try:
    mci = ctypes.windll.winmm.mciSendStringW
    alias = f"jtts_{int(time.time()*1000)}"
    mci(f'open "{sys.argv[1]}" type mpegvideo alias {alias}', None, 0, 0)
    mci(f'setaudio {alias} volume to 600', None, 0, 0)
    mci(f'play {alias} wait', None, 0, 0)
    mci(f'close {alias}', None, 0, 0)
except Exception:
    pass
    `.trim();

    const proc = spawn('python', ['-c', playScript, filePath], {
      stdio: 'ignore',
      detached: false,
    });

    this.currentProcess = proc;

    proc.on('close', () => {
      this.isSpeakingFlag = false;
      voiceDaemonManager.notifyTtsSpeaking(false);
      this.currentProcess = null;
    });

    proc.on('error', () => {
      this.isSpeakingFlag = false;
      voiceDaemonManager.notifyTtsSpeaking(false);
      this.currentProcess = null;
    });
  }

  public stopLocalPlayback() {
    if (this.currentProcess) {
      try {
        this.currentProcess.kill();
      } catch {
        // ignore
      }
      this.currentProcess = null;
    }
    this.isSpeakingFlag = false;
    voiceDaemonManager.notifyTtsSpeaking(false);
  }

  private startBackgroundPrecaching() {
    setTimeout(async () => {
      try {
        const voices = [
          { name: 'ru-RU-SvetlanaNeural', pitch: '+0Hz' },
          { name: 'ru-RU-DmitryNeural', pitch: '-5Hz' },
        ];
        const rate = '+20%';

        for (const v of voices) {
          for (const key of Object.keys(PRESET_PHRASES)) {
            for (const phrase of PRESET_PHRASES[key]) {
              const filename = getPhraseFilename(phrase, v.name, rate);
              const filePath = path.join(this.cacheDir, filename);
              if (!fs.existsSync(filePath)) {
                await this.synthesizeToDisk(phrase, filePath, v.name, rate, v.pitch);
              }
            }
          }
        }
      } catch (err: any) {
        logger.warn('TtsService', `Background precaching note: ${err?.message || err}`);
      }
    }, 3000);
  }
}

export const ttsService = new TtsService();
