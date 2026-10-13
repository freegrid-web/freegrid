/**
 * @class Storage
 * @plugin PersistentState
 *
 * Values in `localStorage` under `<prefix>_<key>`, as JSON. The keys in use are kept under
 * `<prefix>__persistentStateKeys`.
 */
class Storage {
  /**
   * Prefix for key (id element).
   */
  prefix: string;

  /**
   * Saved keys.
   */
  savedKeys: string[] = [];

  constructor(prefix: string) {
    this.prefix = prefix;
    this.loadSavedKeys();
  }

  /**
   * Save data to localStorage.
   *
   * @param key Key string.
   * @param value Value to save.
   */
  saveValue(key: string, value: unknown): void {
    window.localStorage.setItem(`${this.prefix}_${key}`, JSON.stringify(value));

    if (!this.savedKeys.includes(key)) {
      this.savedKeys.push(key);
      this.saveSavedKeys();
    }
  }

  /**
   * Load data from localStorage.
   *
   * @param key Key string.
   * @param defaultValue The key to read when `key` is undefined.
   * @returns The value, or `undefined` when there is none.
   */
  loadValue(key?: string, defaultValue?: string): unknown {
    const value = window.localStorage.getItem(`${this.prefix}_${key === undefined ? defaultValue : key}`);

    return value === null ? undefined : JSON.parse(value);
  }

  /**
   * Reset given data from localStorage.
   *
   * @param key Key string.
   */
  reset(key: string): void {
    window.localStorage.removeItem(`${this.prefix}_${key}`);
  }

  /**
   * Reset all data from localStorage.
   */
  resetAll(): void {
    this.savedKeys.forEach(key => window.localStorage.removeItem(`${this.prefix}_${key}`));
    this.clearSavedKeys();
  }

  /**
   * Load and save all keys from localStorage.
   *
   * @private
   */
  loadSavedKeys(): void {
    const keysJSON = window.localStorage.getItem(`${this.prefix}__persistentStateKeys`);

    this.savedKeys = (typeof keysJSON === 'string' ? JSON.parse(keysJSON) : undefined) || [];
  }

  /**
   * Save saved key in localStorage.
   *
   * @private
   */
  saveSavedKeys(): void {
    window.localStorage.setItem(`${this.prefix}__persistentStateKeys`, JSON.stringify(this.savedKeys));
  }

  /**
   * Clear saved key from localStorage.
   *
   * @private
   */
  clearSavedKeys(): void {
    this.savedKeys.length = 0;
    this.saveSavedKeys();
  }
}

export default Storage;
