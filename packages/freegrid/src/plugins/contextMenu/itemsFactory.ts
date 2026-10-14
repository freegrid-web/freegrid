import { objectEach, isObject, extend } from './../../helpers/object';
import {
  SEPARATOR,
  ITEMS,
  predefinedItems,
} from './predefinedItems';
import type { MenuItem } from './menuItem';
import type { PluginHost } from './../_base';

/** The menu's items: `true` (the default order), keys and items, or `{ items }` (an array, or items by key). */
export type ItemsPattern = boolean | null | (string | MenuItem)[] | { items?: unknown } | Record<string, unknown>;

/**
 * The menu items for `itemsPattern`: predefined items by key (an object in the pattern extends one), and the
 * pattern's own items. Without a pattern (or with `true`), the default order.
 */
const getItems = (itemsPattern: ItemsPattern = null, defaultPattern: string[] = [], items: Record<string, MenuItem> = {}): MenuItem[] => {
  const result: MenuItem[] = [];
  let pattern: unknown = itemsPattern;

  if (pattern && (pattern as { items?: unknown }).items) {
    pattern = (pattern as { items?: unknown }).items;

  } else if (!Array.isArray(pattern)) {
    pattern = defaultPattern;
  }
  if (isObject(pattern)) {
    objectEach(pattern, (value: unknown, key: string) => {
      let item = (items[typeof value === 'string' ? value : key] || value) as MenuItem | string;

      if (isObject(value)) {
        extend(item as MenuItem, value);

      } else if (typeof item === 'string') {
        item = { name: item };
      }
      if ((item as MenuItem).key === undefined) {
        (item as MenuItem).key = key;
      }
      result.push(item as MenuItem);
    });
  } else {
    (pattern as (string | MenuItem)[]).forEach((name, key) => {
      let item = items[name as string];

      // Item deleted from settings `allowInsertRow: false` etc.
      if (!item && ITEMS.includes(name as string)) {
        return;
      }
      if (!item) {
        item = { name: name as string, key: `${key}` };
      }
      if (isObject(name)) {
        extend(item, name);
      }
      if (item.key === undefined) {
        // The index, as a number (as before).
        item.key = key as unknown as string;
      }
      result.push(item);
    });
  }

  return result;
};

/**
 * Predefined items class factory for menu items.
 *
 * @class ItemsFactory
 * @plugin ContextMenu
 */
class ItemsFactory {
  hot: PluginHost;

  /** The items that can be shown, by key. */
  predefinedItems: Record<string, MenuItem> = predefinedItems();

  /** The keys of the items, in the default order. */
  defaultOrderPattern: string[] | null;

  constructor(hotInstance: PluginHost, orderPattern: string[] | null = null) {
    this.hot = hotInstance;
    this.defaultOrderPattern = orderPattern;
  }

  /**
   * Set predefined items (they become the default order too).
   *
   * @param predefinedItemsCollection Array of predefined items.
   */
  setPredefinedItems(predefinedItemsCollection: MenuItem[] | Record<string, MenuItem>): void {
    const items: Record<string, MenuItem> = {};
    const orderPattern = this.defaultOrderPattern!;

    orderPattern.length = 0;

    objectEach(predefinedItemsCollection as Record<string, MenuItem>, (value: MenuItem, key: string) => {
      let menuItemKey: string;

      if (value.name === SEPARATOR) {
        items[SEPARATOR] = value;
        menuItemKey = SEPARATOR;

        // Menu item added as a property to array
      } else if (Number.isNaN(parseInt(key, 10))) {
        value.key = value.key === undefined ? key : value.key;
        items[key] = value;
        menuItemKey = value.key;

      } else {
        items[value.key!] = value;
        menuItemKey = value.key!;
      }
      orderPattern.push(menuItemKey);
    });
    this.predefinedItems = items;
  }

  /**
   * Get all menu items based on pattern.
   *
   * @param [pattern] Pattern which you can define by displaying menu items order. If `true` default
   *                  pattern will be used.
   */
  getItems(pattern: ItemsPattern = null): MenuItem[] {
    return getItems(pattern, this.defaultOrderPattern ?? undefined, this.predefinedItems);
  }
}

export default ItemsFactory;
