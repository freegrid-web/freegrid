import { CONDITIONS, conditionsForType, getCondition, getConditionNames, registerCondition } from '../../../src/plugins/filters/conditions';

describe('filter conditions', () => {
  it('adds a custom condition, offered for the column types it lists', () => {
    registerCondition('even', { title: 'Even', arity: 0, types: ['numeric'], test: value => Number(value) % 2 === 0 });

    expect(getConditionNames()).toContain('even');
    expect(getCondition('even')!.test(4, [], {})).toBe(true);
    expect(getCondition('even')!.arity).toBe(0);
    expect(conditionsForType('numeric')).toContain('even');
    expect(conditionsForType(void 0)).not.toContain('even');
  });

  it('offers a condition without types for every column, and takes 1 argument by default', () => {
    registerCondition('regex', { test: (value, [pattern]) => new RegExp(String(pattern), 'i').test(String(value)) });

    expect(getCondition('regex')!.arity).toBe(1);
    expect(getCondition('regex')!.title).toBe('regex');
    expect(conditionsForType('date')).toContain('regex');
    expect(conditionsForType('dropdown')).toContain('regex');
  });

  it('replaces a built-in condition', () => {
    registerCondition('contains', { title: 'Has', types: ['text'], test: (value, [text]) => String(value) === text });

    expect(CONDITIONS.contains.test('abc', ['b'], {})).toBe(false);
    expect(conditionsForType('text').filter(name => name === 'contains')).toEqual(['contains']);
    expect(conditionsForType('numeric')).not.toContain('contains');
  });

  it('needs a name and a test function', () => {
    expect(() => registerCondition('', { test: () => true })).toThrow();
    expect(() => registerCondition('x', {} as never)).toThrow();
  });
});
