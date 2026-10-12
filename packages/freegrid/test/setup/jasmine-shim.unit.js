describe('jasmine shim', () => {
  it('createSpy records calls and supports .and.returnValue', () => {
    const spy = jasmine.createSpy('s').and.returnValue(42);

    expect(spy(1, 2)).toBe(42);
    expect(spy.calls.count()).toBe(1);
    expect(spy.calls.argsFor(0)).toEqual([1, 2]);
    expect(spy.calls.mostRecent().args).toEqual([1, 2]);
    expect(spy).toHaveBeenCalledWith(1, 2);
    spy.calls.reset();
    expect(spy.calls.count()).toBe(0);
  });

  it('spyOn stubs by default and callThrough restores original behaviour', () => {
    const obj = { f: x => x * 2 };

    spyOn(obj, 'f');
    expect(obj.f(2)).toBeUndefined();
    obj.f.and.callThrough();
    expect(obj.f(2)).toBe(4);
    obj.f.and.callFake(() => 'fake');
    expect(obj.f(2)).toBe('fake');
    expect(obj.f.calls.count()).toBe(3);
  });

  it('jasmine.any works inside toHaveBeenCalledWith', () => {
    const spy = jasmine.createSpy();

    spy('a', 1);
    expect(spy).toHaveBeenCalledWith(jasmine.any(String), jasmine.any(Number));
  });

  it('supports done callbacks', (done) => {
    setTimeout(() => done(), 1);
  });

  it('exposes jest as vi', () => {
    expect(typeof jest.useFakeTimers).toBe('function');
  });

  it('custom matchers from jasmine.addMatchers work', () => {
    jasmine.addMatchers({
      toBeAnswer() {
        return { compare(actual) { return { pass: actual === 42, message: 'not 42' }; } };
      },
    });
    expect(42).toBeAnswer();
    expect(1).not.toBeAnswer();
  });

  describe('spyOn restoration between specs (Jasmine semantics)', () => {
    const target = { f: () => 'real' };

    it('first spec spies and calls', () => {
      spyOn(target, 'f');
      target.f();
      expect(target.f.calls.count()).toBe(1);
    });

    it('second spec sees the original again and a fresh spy', () => {
      expect(target.f()).toBe('real');
      spyOn(target, 'f');
      expect(target.f.calls.count()).toBe(0);
    });
  });

  it('initMouseEvent accepts the global window as view (jsdom adapter)', () => {
    const event = document.createEvent('MouseEvents');

    expect(() => event.initMouseEvent('click', true, true, window, 0, 0, 0, 1, 1,
      false, false, false, false, 0, document.body.parentNode)).not.toThrow();
    expect(event.view).toBe(globalThis.jsdom.window);
  });
});
