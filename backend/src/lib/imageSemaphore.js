// backend/src/lib/imageSemaphore.js
class Semaphore {
  constructor(max) {
    this.max = max;
    this.current = 0;
    this.queue = [];
  }

  acquire() {
    return new Promise((resolve) => {
      if (this.current < this.max) {
        this.current++;
        resolve();
      } else {
        this.queue.push(resolve);
      }
    });
  }

  release() {
    if (this.queue.length > 0) {
      this.queue.shift()();
    } else {
      this.current--;
    }
  }

  acquireWithTimeout(ms) {
    return new Promise((resolve, reject) => {
      let settled = false;

      const resolveWrapper = () => {
        if (!settled) {
          settled = true;
          clearTimeout(timer);
          resolve();
        }
      };

      const timer = setTimeout(() => {
        if (!settled) {
          settled = true;
          const idx = this.queue.indexOf(resolveWrapper);
          if (idx !== -1) this.queue.splice(idx, 1);
          const err = new Error('Semaphore timeout');
          err.code = 'SEMAPHORE_TIMEOUT';
          reject(err);
        }
      }, ms);

      if (this.current < this.max) {
        this.current++;
        resolveWrapper();
      } else {
        this.queue.push(resolveWrapper);
      }
    });
  }
}

const MAX = parseInt(process.env.SHARP_CONCURRENCY || '6', 10);
const TIMEOUT_MS = parseInt(process.env.SHARP_QUEUE_TIMEOUT_MS || '8000', 10);

const sharpSemaphore = new Semaphore(MAX);

module.exports = { Semaphore, sharpSemaphore, TIMEOUT_MS };
