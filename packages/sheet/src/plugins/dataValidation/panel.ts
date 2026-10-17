import { registerPanelView, activeGrid } from './../../sidePanel/sidePanel';
import { OPERATORS, parseItems, type Validation, type ValidationOperator } from './rules';
import * as C from './../../i18n/constants';
import type Core from './../../core';
import type { SidePanel } from './../../sidePanel/sidePanel';

type Plugin = { getValidation(row: number, col: number): Validation | null; setValidation(rule: Validation | null): void };

const KINDS: ['' | Validation['type'], string][] = [['', C.VALIDATION_ANY], ['list', C.VALIDATION_LIST],
  ['number', C.VALIDATION_NUMBER], ['integer', C.VALIDATION_INTEGER], ['date', C.VALIDATION_DATE],
  ['textLength', C.VALIDATION_TEXT_LENGTH]];

const OPERATOR_LABELS: Record<ValidationOperator, string> = {
  between: C.VALIDATION_BETWEEN, notBetween: C.VALIDATION_NOT_BETWEEN, equal: C.VALIDATION_EQUAL,
  notEqual: C.VALIDATION_NOT_EQUAL, greater: C.VALIDATION_GREATER, less: C.VALIDATION_LESS,
  greaterOrEqual: C.VALIDATION_GREATER_OR_EQUAL, lessOrEqual: C.VALIDATION_LESS_OR_EQUAL,
};

/**
 * The Data validation panel: the rule of the selected cells (the active cell's, to start from), with its criteria,
 * list items or values, whether invalid values are refused, and its messages. Apply gives it to the selected cells,
 * Remove takes it away.
 */
registerPanelView('dataValidation', (root: Core, panel: SidePanel) => {
  const phrase = (key: string) => String(root.getTranslatedPhrase(key, 0));
  const element = <K extends keyof HTMLElementTagNameMap>(tag: K, className = ''): HTMLElementTagNameMap[K] => {
    const node = document.createElement(tag);

    node.className = className;

    return node;
  };
  const field = (label: string, control: HTMLElement): HTMLLabelElement => {
    const wrapper = element('label', 'fs-validation-panel__field');
    const text = element('span');

    text.textContent = label;
    wrapper.append(text, control);

    return wrapper;
  };
  const select = <T extends string>(options: [T, string][], value: T): HTMLSelectElement => {
    const control = element('select');

    options.forEach(([key, label]) => {
      const option = element('option');

      option.value = key;
      option.textContent = phrase(label);
      control.appendChild(option);
    });
    control.value = value;

    return control;
  };

  return {
    title: () => phrase(C.VALIDATION_TITLE),
    render(body: HTMLElement) {
      const grid = activeGrid(root);
      const plugin = grid.getPlugin('dataValidation') as unknown as Plugin;
      const [row, col] = grid.getSelectedLast() || [0, 0];
      const rule: Partial<Validation> = (row >= 0 && col >= 0 && plugin.getValidation(row, col)) || {};
      const form = element('div', 'fs-validation-panel');
      const kind = select(KINDS, rule.type || '');
      const items = element('textarea');
      const operator = select(OPERATORS.map(name => [name, OPERATOR_LABELS[name]]), rule.operator || 'between');
      const value = element('input');
      const value2 = element('input');
      const strict = element('input');
      const message = element('input');
      const inputMessage = element('input');
      const error = element('p', 'fs-validation-panel__error');
      const listField = field(phrase(C.VALIDATION_ITEMS), items);
      const operatorField = field(phrase(C.VALIDATION_OPERATOR), operator);
      const valueField = field(phrase(C.VALIDATION_VALUE), value);
      const value2Field = field(phrase(C.VALIDATION_VALUE2), value2);
      const strictField = element('label', 'fs-validation-panel__check');
      const sync = () => {
        const type = kind.value;
        const between = operator.value === 'between' || operator.value === 'notBetween';

        listField.hidden = type !== 'list';
        [operatorField, valueField].forEach((part) => {
          part.hidden = type === '' || type === 'list';
        });
        value2Field.hidden = type === '' || type === 'list' || !between;
        value.type = type === 'date' ? 'date' : 'text';
        value2.type = value.type;
      };

      items.rows = 4;
      items.placeholder = phrase(C.VALIDATION_ITEMS_HINT);
      items.value = Array.isArray(rule.source) ? rule.source.join('\n') : rule.source ? `=${rule.source}` : '';
      value.value = rule.value === void 0 ? '' : String(rule.value);
      value2.value = rule.value2 === void 0 ? '' : String(rule.value2);
      strict.type = 'checkbox';
      strict.checked = rule.strict !== false;
      strictField.append(strict, document.createTextNode(` ${phrase(C.VALIDATION_STRICT)}`));
      message.value = rule.message || '';
      inputMessage.value = rule.inputMessage || '';
      kind.addEventListener('change', sync);
      operator.addEventListener('change', sync);
      form.append(field(phrase(C.VALIDATION_CRITERIA), kind), listField, operatorField, valueField, value2Field,
        strictField, field(phrase(C.VALIDATION_MESSAGE), message), field(phrase(C.VALIDATION_INPUT_MESSAGE),
          inputMessage), error);

      const footer = element('div', 'fs-side-panel__footer');
      const button = (label: string, className: string, onClick: () => void) => {
        const control = element('button', className);

        control.type = 'button';
        control.textContent = label;
        control.addEventListener('click', onClick);

        return control;
      };
      const apply = () => {
        const type = kind.value as Validation['type'] | '';

        if (!type) {
          plugin.setValidation(null);
          panel.close();

          return;
        }
        const next: Validation = { type };
        const number = (text: string) => (type === 'date' ? text : Number(text));

        if (type === 'list') {
          const text = items.value.trim();

          next.source = /^=/.test(text) ? text.slice(1).trim() : parseItems(text);
          if (!next.source.length) {
            error.textContent = phrase(C.VALIDATION_NEEDS_ITEMS);

            return;
          }
        } else {
          next.operator = operator.value as ValidationOperator;
          if (value.value.trim() === '' || (type !== 'date' && !Number.isFinite(Number(value.value))) ||
            (!value2Field.hidden && value2.value.trim() === '')) {
            error.textContent = phrase(C.VALIDATION_NEEDS_VALUES);

            return;
          }
          next.value = number(value.value.trim());
          if (!value2Field.hidden) {
            next.value2 = number(value2.value.trim());
          }
        }
        if (!strict.checked) {
          next.strict = false;
        }
        if (message.value.trim()) {
          next.message = message.value.trim();
        }
        if (inputMessage.value.trim()) {
          next.inputMessage = inputMessage.value.trim();
        }
        plugin.setValidation(next);
        panel.close();
      };

      footer.append(button(phrase(C.VALIDATION_REMOVE), 'fs-side-panel__button', () => {
        plugin.setValidation(null);
        panel.close();
      }), element('span', 'fs-side-panel__spacer'), button(phrase(C.VALIDATION_APPLY),
        'fs-side-panel__button fs-side-panel__button--primary fs-validation-panel__apply', apply));
      body.append(form, footer);
      sync();
    },
  };
});
