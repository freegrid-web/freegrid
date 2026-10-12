const order = [];

describe('runner self-test', () => {
  it('a', () => { order.push('a'); });
  it('b', () => { order.push('b'); });
  it('c', () => {
    order.push('c');
    expect(order).toEqual(['a', 'b', 'c']); // fails if Jasmine randomizes order
  });
  it('has jQuery and the test helpers on window', () => {
    expect(typeof window.$).toBe('function');
  });
});
