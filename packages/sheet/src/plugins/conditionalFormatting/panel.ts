import { registerPanelView, activeGrid } from './../../sidePanel/sidePanel';
import { CONDITIONS } from './../filters/conditions';
import { formatRange, parseRange, rectsIntersect } from './ranges';
import * as C from './../../i18n/constants';
import type { Rect } from './ranges';
import type Core from './../../core';
import type { SidePanel } from './../../sidePanel/sidePanel';
import type ConditionalFormatting from './conditionalFormatting';
import type { ConditionalRule, ConditionalStyle } from './conditionalFormatting';

type Kind = 'highlight' | 'top' | 'dataBar' | 'colorScale' | 'iconSet' | 'formula';

/** The format styles the editor offers, as in Excel. */
export const STYLE_PRESETS: ConditionalStyle[] = [
  { background: '#ffc7ce', color: '#9c0006' },
  { background: '#ffeb9c', color: '#9c5700' },
  { background: '#c6efce', color: '#006100' },
  { background: '#ffc7ce' },
  { color: '#9c0006' },
  { border: '1px solid #c00000' },
];
export const DATA_BAR_COLORS = ['#638ec6', '#63c384', '#ff555a', '#ffb628', '#008aef', '#d6007b'];
export const COLOR_SCALES = [
  ['#63be7b', '#ffeb84', '#f8696b'],
  ['#f8696b', '#ffeb84', '#63be7b'],
  ['#63be7b', '#ffffff', '#f8696b'],
  ['#f8696b', '#ffffff', '#5a8ac6'],
  ['#ffffff', '#63be7b'],
  ['#ffffff', '#f8696b'],
];
export const ICON_SETS: { name: 'arrows' | 'trafficLights' | 'signs'; phrase: string }[] = [
  { name: 'arrows', phrase: C.CF_ARROWS },
  { name: 'trafficLights', phrase: C.CF_TRAFFIC_LIGHTS },
  { name: 'signs', phrase: C.CF_SIGNS },
];
/** The conditions of "Highlight cells with", in order. */
const HIGHLIGHT_CONDITIONS = ['gt', 'lt', 'between', 'eq', 'neq', 'gte', 'lte', 'not_between', 'contains',
  'not_contains', 'begins_with', 'ends_with', 'date_today', 'date_yesterday', 'date_tomorrow', 'date_last_7_days',
  'date_this_week', 'date_last_week', 'date_next_week', 'date_this_month', 'date_last_month', 'date_next_month',
  'duplicate', 'unique', 'empty', 'not_empty'];

export const kindOf = (rule: ConditionalRule): Kind => {
  if (rule.colorScale) {
    return 'colorScale';
  }
  if (rule.dataBar) {
    return 'dataBar';
  }
  if (rule.iconSet) {
    return 'iconSet';
  }
  if (typeof rule.when === 'string' && rule.when.charAt(0) === '=') {
    return 'formula';
  }

  return rule.when && ['top', 'bottom', 'aboveAverage', 'belowAverage'].indexOf(rule.when) !== -1 ? 'top' :
    'highlight';
};

const element = <K extends keyof HTMLElementTagNameMap>(tag: K, className = '', text = ''): HTMLElementTagNameMap[K] => {
  const node = document.createElement(tag);

  if (className) {
    node.className = className;
  }
  if (text) {
    node.textContent = text;
  }

  return node;
};

const buttonOf = (text: string, className: string, onClick: () => void, label?: string): HTMLButtonElement => {
  const node = element('button', className, text);

  node.type = 'button';
  node.addEventListener('click', onClick);
  if (label) {
    node.title = label;
    node.setAttribute('aria-label', label);
  }

  return node;
};

/** The plugin of the grid the user works in (turned on when it is off). */
export const pluginOf = (root: Core): ConditionalFormatting => {
  const grid = activeGrid(root);
  let plugin = grid.getPlugin('conditionalFormatting' as 'search') as unknown as ConditionalFormatting;

  if (!plugin.enabled) {
    grid.updateSettings({ conditionalFormatting: true });
    plugin = grid.getPlugin('conditionalFormatting' as 'search') as unknown as ConditionalFormatting;
  }

  return plugin;
};

/** The selected cells as A1 ranges of data cells (whole columns or rows when they were selected by their headers). */
export const selectionRanges = (grid: Core): string[] => {
  const ranges = grid.getSelectedRange() || [];
  const rows = grid.countRows();
  const columns = grid.countCols();
  const byColumns = grid.selection.isSelectedByColumnHeader();
  const byRows = grid.selection.isSelectedByRowHeader();
  const result: string[] = [];

  ranges.forEach((range: { getTopLeftCorner(): { row: number; col: number };
    getBottomRightCorner(): { row: number; col: number } }) => {
    const from = range.getTopLeftCorner();
    const to = range.getBottomRightCorner();
    const [r1, c1] = [Math.max(0, from.row), Math.max(0, from.col)];
    const [r2, c2] = [Math.max(0, to.row), Math.max(0, to.col)];
    const columnRuns = runs(c1, c2, column => grid.toPhysicalColumn(column));

    if (byColumns && r1 === 0 && r2 >= rows - 1) {
      columnRuns.forEach(([a, b]) => result.push(formatRange({ r1: 0, c1: a, r2: Infinity, c2: b })));

      return;
    }
    const rowRuns = runs(r1, r2, row => grid.toPhysicalRow(row));

    if (byRows && c1 === 0 && c2 >= columns - 1) {
      rowRuns.forEach(([a, b]) => result.push(formatRange({ r1: a, c1: 0, r2: b, c2: Infinity })));

      return;
    }
    rowRuns.forEach(([ra, rb]) => columnRuns.forEach(([ca, cb]) =>
      result.push(formatRange({ r1: ra, c1: ca, r2: rb, c2: cb }))));
  });

  return result;
};

/** Visual indexes `from`..`to` as runs of consecutive physical indexes. */
const runs = (from: number, to: number, toPhysical: (index: number) => number): [number, number][] => {
  const physical = Array.from({ length: to - from + 1 }, (_, i) => toPhysical(from + i))
    .filter(index => index !== null && index >= 0).sort((a, b) => a - b);
  const result: [number, number][] = [];

  physical.forEach((index) => {
    const last = result[result.length - 1];

    if (last && index === last[1] + 1) {
      last[1] = index;
    } else if (!last || index > last[1]) {
      result.push([index, index]);
    }
  });

  return result;
};

/** A condition's name in the panel. */
const conditionTitle = (root: Core, name: string): string => {
  const phrase = (key: string) => root.getTranslatedPhrase(key, 0) as string;

  if (name === 'duplicate') {
    return phrase(C.CF_DUPLICATES);
  }
  if (name === 'unique') {
    return phrase(C.CF_UNIQUES);
  }
  const condition = CONDITIONS[name];

  return condition?.title || (condition?.phrase ? phrase(condition.phrase) : name);
};

/** One line that says what a rule does. */
export const describeRule = (root: Core, rule: ConditionalRule): string => {
  const phrase = (key: string) => root.getTranslatedPhrase(key, 0) as string;
  const value = Array.isArray(rule.value) ? rule.value.join(' – ') : rule.value;

  switch (kindOf(rule)) {
    case 'colorScale':
      return phrase(C.CF_KIND_COLOR_SCALE);
    case 'dataBar':
      return phrase(C.CF_KIND_DATA_BAR);
    case 'iconSet':
      return `${phrase(C.CF_KIND_ICON_SET)}: ${phrase(ICON_SETS.find(set => set.name === rule.iconSet)?.phrase || '')}`;
    case 'formula':
      return `${phrase(C.CF_KIND_FORMULA)}: ${rule.when}`;
    case 'top':
      if (rule.when === 'aboveAverage' || rule.when === 'belowAverage') {
        return phrase(rule.when === 'aboveAverage' ? C.CF_AVERAGE_ABOVE : C.CF_AVERAGE_BELOW);
      }

      return `${phrase(rule.when === 'top' ? C.CF_TOP : C.CF_BOTTOM)} ${rule.value ?? 10}${rule.percent ? ' %' : ''}`;
    default: {
      const arity = CONDITIONS[rule.when || '']?.arity ?? 0;

      return `${conditionTitle(root, rule.when || '')}${arity && value !== void 0 && value !== '' ? ` ${value}` : ''}`;
    }
  }
};

/** A small preview of a rule's format. */
export const previewOf = (rule: ConditionalRule): HTMLElement => {
  const preview = element('span', 'fs-cf-preview', 'Aa');

  switch (kindOf(rule)) {
    case 'colorScale':
      preview.textContent = '';
      preview.style.backgroundImage = `linear-gradient(to right, ${(rule.colorScale || []).join(', ')})`;
      break;
    case 'dataBar': {
      const color = typeof rule.dataBar === 'string' ? rule.dataBar : rule.dataBar?.color;

      preview.textContent = '';
      preview.style.backgroundImage = `linear-gradient(to right, ${color} 65%, transparent 65%)`;
      break;
    }
    case 'iconSet':
      preview.textContent = '';
      ['high', 'middle', 'low'].forEach(level => preview.append(element('span',
        `fs-cf-icon fs-cf-icon--${rule.iconSet}-${level}`)));
      preview.classList.add('fs-cf-preview--icons');
      break;
    default:
      Object.entries(rule.style || {}).forEach(([property, value]) => {
        (preview.style as unknown as Record<string, string>)[property] = String(value);
      });
  }

  return preview;
};

/**
 * The rule manager: the rules of the selection or of the sheet, each with its format, its description and its range;
 * a click edits a rule; + adds one; arrows change the priority; the bin deletes a rule.
 */
registerPanelView('conditionalFormatting', (root: Core, panel: SidePanel, options: Record<string, unknown>) => {
  const phrase = (key: string) => root.getTranslatedPhrase(key, 0) as string;
  let scope = options.scope === 'selection' ? 'selection' : 'sheet';
  const watched = activeGrid(root);
  const onChange = () => panel.refresh();

  watched.addHook('afterConditionalFormattingChange', onChange);

  return {
    title: () => phrase(C.CF_TITLE),
    render(body: HTMLElement) {
      const plugin = pluginOf(root);
      const grid = activeGrid(root);
      const toolbar = element('div', 'fs-side-panel__row');
      const label = element('span', '', phrase(C.CF_MANAGE_IN));
      const select = element('select', 'fs-cf-panel__scope');

      [['selection', C.CF_SCOPE_SELECTION], ['sheet', C.CF_SCOPE_SHEET]].forEach(([value, key]) => {
        const option = element('option', '', phrase(key));

        option.value = value;
        option.selected = value === scope;
        select.append(option);
      });
      select.setAttribute('aria-label', phrase(C.CF_MANAGE_IN));
      select.addEventListener('change', () => {
        scope = select.value;
        panel.refresh();
      });
      toolbar.append(label, select, element('span', 'fs-side-panel__spacer'),
        buttonOf('', 'fs-side-panel__icon-button fs-cf-panel__add', () => panel.open('conditionalFormattingRule',
          { back: 'conditionalFormatting' }), phrase(C.CF_ADD)));
      body.append(toolbar);

      const selected = selectionRanges(grid).map(range => parseRange(range)).filter((rect): rect is Rect => !!rect);
      const rules = plugin.getRules().filter(rule => scope === 'sheet' || (Array.isArray(rule.range) ? rule.range :
        [rule.range]).some(range => {
        const rect = parseRange(String(range));

        return !!rect && selected.some(cut => rectsIntersect(rect, cut));
      }));

      if (!rules.length) {
        body.append(element('p', 'fs-side-panel__muted', phrase(C.CF_NO_RULES)));
      }
      const all = plugin.getRules();

      rules.forEach((rule) => {
        const card = element('div', 'fs-side-panel__card fs-side-panel__card--link fs-cf-panel__rule');
        const top = element('div', 'fs-side-panel__row');
        const text = element('span', 'fs-cf-panel__description', describeRule(root, rule));
        const range = element('div', 'fs-side-panel__muted');
        const index = all.findIndex(item => item.id === rule.id);
        const stop = (event: Event) => event.stopPropagation();
        const up = buttonOf('', 'fs-side-panel__icon-button fs-cf-panel__up', () => plugin.moveRule(rule.id, index - 1),
          phrase(C.CF_MOVE_UP));
        const down = buttonOf('', 'fs-side-panel__icon-button fs-cf-panel__down', () => plugin.moveRule(rule.id,
          index + 1), phrase(C.CF_MOVE_DOWN));
        const remove = buttonOf('', 'fs-side-panel__icon-button fs-cf-panel__delete', () => plugin.removeRule(rule.id),
          phrase(C.CF_DELETE));

        up.disabled = index === 0;
        down.disabled = index === all.length - 1;
        [up, down, remove].forEach(control => control.addEventListener('click', stop));
        card.tabIndex = 0;
        card.dataset.rule = rule.id;
        top.append(previewOf(rule), text, element('span', 'fs-side-panel__spacer'), up, down, remove);
        range.textContent = `${phrase(C.CF_APPLY_TO)}: ${(Array.isArray(rule.range) ? rule.range : [rule.range])
          .join(', ')}`;
        card.append(top, range);
        card.addEventListener('click', () => panel.open('conditionalFormattingRule',
          { id: rule.id, back: 'conditionalFormatting' }));
        card.addEventListener('keydown', (event) => {
          if (event.key === 'Enter') {
            panel.open('conditionalFormattingRule', { id: rule.id, back: 'conditionalFormatting' });
          }
        });
        body.append(card);
      });
      body.append(element('p', 'fs-side-panel__muted', phrase(C.CF_INFO)));
    },
    destroy() {
      if (!watched.isDestroyed) {
        watched.removeHook('afterConditionalFormattingChange', onChange);
      }
    },
  };
});

/**
 * The rule editor: the range, the kind of rule and its settings, and the format. The grid shows the rule while it is
 * edited; Done keeps it, Cancel (or Escape, or closing the panel) drops the changes.
 */
registerPanelView('conditionalFormattingRule', (root: Core, panel: SidePanel, options: Record<string, unknown>) => {
  const phrase = (key: string) => root.getTranslatedPhrase(key, 0) as string;
  const plugin = pluginOf(root);
  const existing = typeof options.id === 'string' ? plugin.getRules().find(rule => rule.id === options.id) : void 0;
  const preset = (options.preset || {}) as ConditionalRule;
  const selection = selectionRanges(activeGrid(root));
  const original: ConditionalRule | null = existing ? (({ id: _id, ...rule }) => rule)(existing) : null;
  const draft: ConditionalRule = original ? JSON.parse(JSON.stringify(original)) : {
    range: selection.length ? (selection.length === 1 ? selection[0] : selection) : 'A1',
    when: 'gt',
    value: '',
    style: { ...STYLE_PRESETS[0] },
    ...JSON.parse(JSON.stringify(preset)),
  };
  // The rule shows in the grid while it is edited.
  const id = existing ? existing.id : plugin.addRule(draft);
  let finished = false;
  let customOpen = false;
  const back = typeof options.back === 'string' ? options.back : 'conditionalFormatting';

  const apply = () => plugin.updateRule(id, draft);
  const finish = (keep: boolean) => {
    finished = true;
    if (!keep) {
      if (original) {
        plugin.updateRule(id, original);
      } else {
        plugin.removeRule(id);
      }
    }
    panel.open(back);
  };

  const setKind = (kind: Kind) => {
    ['when', 'value', 'percent', 'colorScale', 'dataBar', 'iconSet', 'stopIfTrue'].forEach(key =>
      delete (draft as Record<string, unknown>)[key]);
    if (kind === 'highlight') {
      Object.assign(draft, { when: 'gt', value: '' });
    } else if (kind === 'top') {
      Object.assign(draft, { when: 'top', value: 10 });
    } else if (kind === 'formula') {
      Object.assign(draft, { when: '=' });
    } else if (kind === 'dataBar') {
      draft.dataBar = DATA_BAR_COLORS[0];
    } else if (kind === 'colorScale') {
      draft.colorScale = [...COLOR_SCALES[0]];
    } else {
      draft.iconSet = 'arrows';
    }
    if (kind === 'highlight' || kind === 'top' || kind === 'formula') {
      draft.style = draft.style || { ...STYLE_PRESETS[0] };
    }
    apply();
    panel.refresh();
  };

  const field = (labelText: string, control: HTMLElement): HTMLElement => {
    const wrapper = element('label', 'fs-cf-panel__field');

    wrapper.append(element('span', 'fs-side-panel__label', labelText), control);

    return wrapper;
  };

  const valueInputs = (arity: number): HTMLElement => {
    const row = element('div', 'fs-side-panel__row');
    const values = Array.isArray(draft.value) ? draft.value : [draft.value];

    for (let index = 0; index < arity; index += 1) {
      const input = element('input', 'fs-cf-panel__value');

      input.type = 'text';
      input.value = values[index] === void 0 || values[index] === null ? '' : String(values[index]);
      input.placeholder = phrase(index === 0 ? C.FILTERS_BUTTONS_PLACEHOLDER_VALUE :
        C.FILTERS_BUTTONS_PLACEHOLDER_SECOND_VALUE);
      input.setAttribute('aria-label', input.placeholder);
      input.addEventListener('input', () => {
        if (arity === 2) {
          const pair = Array.isArray(draft.value) ? [...draft.value] : [draft.value, ''];

          pair[index] = input.value;
          draft.value = pair;
        } else {
          draft.value = input.value;
        }
        apply();
      });
      row.append(input);
    }

    return row;
  };

  const swatches = <T>(items: T[], isActive: (item: T) => boolean, draw: (item: T, swatch: HTMLButtonElement) => void,
    choose: (item: T) => void, label: (item: T) => string): HTMLElement => {
    const row = element('div', 'fs-cf-panel__swatches');

    items.forEach((item) => {
      const swatch = buttonOf('', `fs-cf-panel__swatch${isActive(item) ? ' fs-cf-panel__swatch--active' : ''}`,
        () => {
          choose(item);
          apply();
          panel.refresh();
        }, label(item));

      swatch.setAttribute('aria-pressed', String(isActive(item)));
      draw(item, swatch);
      row.append(swatch);
    });

    return row;
  };

  return {
    title: () => phrase(C.CF_TITLE),
    back,
    onEscape: () => finish(false),
    render(body: HTMLElement) {
      const card = element('div', 'fs-side-panel__card');
      const kind = kindOf(draft);

      // Apply to.
      const rangeRow = element('div', 'fs-side-panel__row');
      const rangeInput = element('input', 'fs-cf-panel__range');
      const ranges = Array.isArray(draft.range) ? draft.range : [draft.range || ''];
      const message = element('div', 'fs-cf-panel__error');

      rangeInput.type = 'text';
      rangeInput.value = ranges.join(', ');
      rangeInput.setAttribute('aria-label', phrase(C.CF_APPLY_TO));
      rangeInput.addEventListener('input', () => {
        const parts = rangeInput.value.split(/[,;]\s*/).map(part => part.trim()).filter(Boolean);
        const valid = parts.length > 0 && parts.every(part => parseRange(part));

        rangeInput.setAttribute('aria-invalid', String(!valid));
        message.textContent = valid ? '' : phrase(C.CF_INVALID_RANGE);
        if (valid) {
          draft.range = parts.length === 1 ? parts[0] : parts;
          apply();
        }
      });
      rangeRow.append(rangeInput, buttonOf('', 'fs-side-panel__icon-button fs-cf-panel__use-selection', () => {
        const current = selectionRanges(activeGrid(root));

        if (current.length) {
          draft.range = current.length === 1 ? current[0] : current;
          apply();
          panel.refresh();
        }
      }, phrase(C.CF_USE_SELECTION)));
      card.append(field(phrase(C.CF_APPLY_TO), rangeRow), message);

      // The kind of rule.
      const kinds: [Kind, string][] = [['highlight', C.CF_KIND_HIGHLIGHT], ['top', C.CF_KIND_TOP],
        ['dataBar', C.CF_KIND_DATA_BAR], ['colorScale', C.CF_KIND_COLOR_SCALE], ['iconSet', C.CF_KIND_ICON_SET],
        ['formula', C.CF_KIND_FORMULA]];
      const tabs = element('div', 'fs-cf-panel__kinds');

      tabs.setAttribute('role', 'tablist');
      kinds.forEach(([name, key]) => {
        const tab = buttonOf('', `fs-cf-panel__kind fs-cf-panel__kind--${name}${name === kind ?
          ' fs-cf-panel__kind--active' : ''}`, () => name !== kind && setKind(name), phrase(key));

        tab.setAttribute('role', 'tab');
        tab.setAttribute('aria-selected', String(name === kind));
        tabs.append(tab);
      });
      card.append(tabs);

      if (kind === 'highlight') {
        const select = element('select', 'fs-cf-panel__condition');

        HIGHLIGHT_CONDITIONS.forEach((name) => {
          const option = element('option', '', conditionTitle(root, name));

          option.value = name;
          option.selected = name === draft.when;
          select.append(option);
        });
        select.addEventListener('change', () => {
          draft.when = select.value;
          draft.value = (CONDITIONS[select.value]?.arity ?? 0) === 2 ? ['', ''] : '';
          apply();
          panel.refresh();
        });
        card.append(field(phrase(C.CF_HIGHLIGHT_WITH), select));
        card.append(valueInputs(CONDITIONS[draft.when || '']?.arity ?? 0));
      } else if (kind === 'top') {
        const select = element('select', 'fs-cf-panel__condition');

        [['top', C.CF_TOP], ['bottom', C.CF_BOTTOM], ['aboveAverage', C.CF_AVERAGE_ABOVE],
          ['belowAverage', C.CF_AVERAGE_BELOW]].forEach(([value, key]) => {
          const option = element('option', '', phrase(key));

          option.value = value;
          option.selected = value === draft.when;
          select.append(option);
        });
        select.addEventListener('change', () => {
          draft.when = select.value;
          apply();
          panel.refresh();
        });
        card.append(field(phrase(C.CF_KIND_TOP), select));
        if (draft.when === 'top' || draft.when === 'bottom') {
          const row = element('div', 'fs-side-panel__row');
          const count = element('input', 'fs-cf-panel__count');
          const percent = element('input');
          const percentLabel = element('label', 'fs-side-panel__row');

          count.type = 'number';
          count.min = '1';
          count.value = String(draft.value ?? 10);
          count.setAttribute('aria-label', phrase(C.CF_KIND_TOP));
          count.addEventListener('input', () => {
            draft.value = Number(count.value) || 1;
            apply();
          });
          percent.type = 'checkbox';
          percent.className = 'fs-cf-panel__percent';
          percent.checked = !!draft.percent;
          percent.addEventListener('change', () => {
            draft.percent = percent.checked;
            apply();
          });
          percentLabel.append(percent, element('span', '', phrase(C.CF_PERCENT)));
          row.append(count, percentLabel);
          card.append(row);
        }
      } else if (kind === 'formula') {
        const input = element('input', 'fs-cf-panel__formula');

        input.type = 'text';
        input.value = draft.when || '=';
        input.addEventListener('input', () => {
          draft.when = input.value.charAt(0) === '=' ? input.value : `=${input.value}`;
          apply();
        });
        card.append(field(phrase(C.CF_KIND_FORMULA), input), element('div', 'fs-side-panel__muted',
          phrase(C.CF_FORMULA_HINT)));
      } else if (kind === 'dataBar') {
        card.append(swatches(DATA_BAR_COLORS, color => (typeof draft.dataBar === 'string' ? draft.dataBar :
          draft.dataBar?.color) === color, (color, swatch) => {
          swatch.style.backgroundImage = `linear-gradient(to right, ${color} 65%, transparent 65%)`;
        }, (color) => {
          draft.dataBar = color;
        }, color => color));
      } else if (kind === 'colorScale') {
        card.append(swatches(COLOR_SCALES, colors => JSON.stringify(colors) === JSON.stringify(draft.colorScale),
          (colors, swatch) => {
            swatch.style.backgroundImage = `linear-gradient(to right, ${colors.join(', ')})`;
          }, (colors) => {
            draft.colorScale = [...colors];
          }, colors => colors.join(' – ')));
      } else {
        card.append(swatches(ICON_SETS, set => set.name === draft.iconSet, (set, swatch) => {
          ['high', 'middle', 'low'].forEach(level => swatch.append(element('span',
            `fs-cf-icon fs-cf-icon--${set.name}-${level}`)));
        }, (set) => {
          draft.iconSet = set.name;
        }, set => phrase(set.phrase)));
      }

      // Stop if true, and the format of highlight, top/bottom and formula rules.
      if (kind === 'highlight' || kind === 'top' || kind === 'formula') {
        const stopLabel = element('label', 'fs-side-panel__row');
        const stop = element('input', 'fs-cf-panel__stop');

        stop.type = 'checkbox';
        stop.checked = !!draft.stopIfTrue;
        stop.addEventListener('change', () => {
          draft.stopIfTrue = stop.checked;
          apply();
        });
        stopLabel.append(stop, element('span', '', phrase(C.CF_STOP_IF_TRUE)));
        card.append(stopLabel, element('div', 'fs-side-panel__label', phrase(C.CF_FORMAT_STYLE)));

        const sameStyle = (style: ConditionalStyle) => JSON.stringify(style) === JSON.stringify(draft.style || {});
        const styles = swatches(STYLE_PRESETS, sameStyle, (style, swatch) => {
          swatch.textContent = 'Aa';
          swatch.classList.add('fs-cf-panel__swatch--text');
          Object.entries(style).forEach(([property, value]) => {
            (swatch.style as unknown as Record<string, string>)[property] = String(value);
          });
        }, (style) => {
          draft.style = { ...style };
          customOpen = false;
        }, () => phrase(C.CF_FORMAT_STYLE));
        const custom = buttonOf('+', 'fs-cf-panel__swatch fs-cf-panel__swatch--text fs-cf-panel__custom', () => {
          customOpen = !customOpen;
          panel.refresh();
        }, phrase(C.CF_CUSTOM_FORMAT));

        styles.append(custom);
        card.append(styles);

        if (customOpen || !STYLE_PRESETS.some(sameStyle)) {
          const custom2 = element('div', 'fs-cf-panel__custom-format');
          const color = (key: 'background' | 'color', labelKey: string) => {
            const input = element('input');

            input.type = 'color';
            input.value = /^#[0-9a-f]{6}$/i.test(draft.style?.[key] || '') ? draft.style![key]! :
              (key === 'background' ? '#ffffff' : '#000000');
            input.addEventListener('input', () => {
              draft.style = { ...draft.style, [key]: input.value };
              apply();
            });

            return field(phrase(labelKey), input);
          };
          const check = (key: 'fontWeight' | 'fontStyle', on: string, labelKey: string) => {
            const label = element('label', 'fs-side-panel__row');
            const input = element('input');

            input.type = 'checkbox';
            input.checked = draft.style?.[key] === on;
            input.addEventListener('change', () => {
              const style = { ...draft.style };

              if (input.checked) {
                style[key] = on;
              } else {
                delete style[key];
              }
              draft.style = style;
              apply();
            });
            label.append(input, element('span', '', phrase(labelKey)));

            return label;
          };

          custom2.append(color('background', C.CF_FILL), color('color', C.CF_TEXT_COLOR),
            check('fontWeight', 'bold', C.CF_BOLD), check('fontStyle', 'italic', C.CF_ITALIC));
          card.append(custom2);
        }
      }
      body.append(card);

      const footer = element('div', 'fs-side-panel__footer');

      footer.append(
        buttonOf(phrase(C.CF_DONE), 'fs-side-panel__button fs-side-panel__button--primary fs-cf-panel__done',
          () => finish(true)),
        buttonOf(phrase(C.CF_CANCEL), 'fs-side-panel__button fs-cf-panel__cancel', () => finish(false)),
      );
      body.append(footer);
    },
    destroy() {
      // Closed without Done: the changes go.
      if (!finished) {
        finished = true;
        if (original) {
          plugin.updateRule(id, original);
        } else {
          plugin.removeRule(id);
        }
      }
    },
  };
});
