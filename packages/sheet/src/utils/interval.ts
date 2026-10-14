/**
 * Calls a function repeatedly on animation frames, at most once per `delay` (milliseconds, or a frame rate such as
 * `'15fps'`).
 */
class Interval {
  static create(func: () => void, delay?: number | string): Interval {
    return new Interval(func, delay);
  }

  /** Milliseconds between two calls (0: every animation frame). */
  readonly delay: number;

  #func: () => void;

  #timer: number | null = null;

  #stopped = true;

  /** Time of the last call. */
  #then = 0;

  constructor(func: () => void, delay?: number | string) {
    this.#func = func;
    this.delay = parseDelay(delay);
  }

  start(): this {
    if (this.#stopped) {
      this.#then = Date.now();
      this.#stopped = false;
      this.#timer = requestAnimationFrame(this.#tick);
    }

    return this;
  }

  stop(): this {
    if (!this.#stopped) {
      this.#stopped = true;
      cancelAnimationFrame(this.#timer as number);
      this.#timer = null;
    }

    return this;
  }

  #tick = (): void => {
    this.#timer = requestAnimationFrame(this.#tick);

    if (!this.delay) {
      this.#func();

      return;
    }
    const now = Date.now();
    const elapsed = now - this.#then;

    if (elapsed > this.delay) {
      this.#then = now - (elapsed % this.delay);
      this.#func();
    }
  };
}

export default Interval;

/**
 * A delay in milliseconds: a number as it is, a frame rate such as `'60fps'` as 1000 / 60.
 */
export const parseDelay = (delay?: number | string): number => {
  if (typeof delay === 'string' && /fps$/.test(delay)) {
    return 1000 / parseInt(delay.replace('fps', '') || '0', 10);
  }

  return delay as number;
};
