import { getVeronicaDb } from './veronicaDb';

type WriteTask<T> = () => T | Promise<T>;

interface QueueItem {
  task: WriteTask<any>;
  resolve: (value: any) => void;
  reject: (reason?: any) => void;
}

export class VeronicaWriteQueue {
  private static instance: VeronicaWriteQueue;
  private queue: QueueItem[] = [];
  private isProcessing = false;

  private constructor() {}

  public static getInstance(): VeronicaWriteQueue {
    if (!VeronicaWriteQueue.instance) {
      VeronicaWriteQueue.instance = new VeronicaWriteQueue();
    }
    return VeronicaWriteQueue.instance;
  }

  /**
   * Enqueue a synchronous or async write operation
   */
  public async enqueue<T>(task: WriteTask<T>): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      this.queue.push({ task, resolve, reject });
      this.processNext();
    });
  }

  private async processNext(): Promise<void> {
    if (this.isProcessing || this.queue.length === 0) {
      return;
    }

    this.isProcessing = true;
    const item = this.queue.shift();
    if (!item) {
      this.isProcessing = false;
      return;
    }

    try {
      const result = await item.task();
      item.resolve(result);
    } catch (err) {
      item.reject(err);
    } finally {
      this.isProcessing = false;
      if (this.queue.length > 0) {
        // Use microtask queue to avoid deep stack recursion
        queueMicrotask(() => this.processNext());
      }
    }
  }

  /**
   * Helper to run an inline transaction via write queue
   */
  public async runTransaction<T>(fn: () => T): Promise<T> {
    return this.enqueue(() => {
      const db = getVeronicaDb();
      db.exec('BEGIN TRANSACTION;');
      try {
        const res = fn();
        db.exec('COMMIT;');
        return res;
      } catch (err) {
        db.exec('ROLLBACK;');
        throw err;
      }
    });
  }
}

export const writeQueue = VeronicaWriteQueue.getInstance();
