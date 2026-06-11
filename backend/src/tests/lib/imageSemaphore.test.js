// backend/src/tests/lib/imageSemaphore.test.js
const { Semaphore } = require('../../lib/imageSemaphore');

describe('Semaphore', () => {
  test('acquire resuelve inmediatamente cuando hay slot disponible', async () => {
    const sem = new Semaphore(2);
    await expect(sem.acquire()).resolves.toBeUndefined();
    expect(sem.current).toBe(1);
  });

  test('acquire encola cuando no hay slots disponibles', async () => {
    const sem = new Semaphore(1);
    await sem.acquire(); // slot lleno

    let resolved = false;
    const waiting = sem.acquire().then(() => { resolved = true; });

    expect(resolved).toBe(false);
    sem.release();
    await waiting;
    expect(resolved).toBe(true);
  });

  test('release desencola en orden FIFO', async () => {
    const sem = new Semaphore(1);
    await sem.acquire();

    const order = [];
    const p1 = sem.acquire().then(() => order.push(1));
    const p2 = sem.acquire().then(() => order.push(2));

    sem.release();
    sem.release();

    await Promise.all([p1, p2]);
    expect(order).toEqual([1, 2]);
  });

  test('release decrementa current cuando la cola está vacía', () => {
    const sem = new Semaphore(2);
    sem.current = 1;
    sem.release();
    expect(sem.current).toBe(0);
  });

  test('acquireWithTimeout resuelve si hay slot disponible', async () => {
    const sem = new Semaphore(2);
    await expect(sem.acquireWithTimeout(100)).resolves.toBeUndefined();
  });

  test('acquireWithTimeout rechaza con SEMAPHORE_TIMEOUT cuando expira', async () => {
    jest.useFakeTimers();
    const sem = new Semaphore(1);
    await sem.acquire(); // slot lleno

    const p = sem.acquireWithTimeout(1000);
    jest.advanceTimersByTime(1001);

    await expect(p).rejects.toMatchObject({ code: 'SEMAPHORE_TIMEOUT' });
    jest.useRealTimers();
  });

  test('acquireWithTimeout no queda en cola tras timeout', async () => {
    jest.useFakeTimers();
    const sem = new Semaphore(1);
    await sem.acquire(); // slot lleno

    const p = sem.acquireWithTimeout(500);
    jest.advanceTimersByTime(600);
    await expect(p).rejects.toMatchObject({ code: 'SEMAPHORE_TIMEOUT' });

    sem.release();
    expect(sem.current).toBe(0);
    expect(sem.queue.length).toBe(0);
    jest.useRealTimers();
  });
});
