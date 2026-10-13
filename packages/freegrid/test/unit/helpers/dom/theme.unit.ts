import { applyTheme, getStyleClassName } from '../../../../src/helpers/dom/theme';

describe('theme helpers', () => {
  const tree = (html: string) => {
    const root = document.createElement('div');

    root.innerHTML = html;
    document.body.appendChild(root);

    return root;
  };

  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('finds the closest style, Classic or Modern, by class or attribute', () => {
    const root = tree(`<div class="fg-style-modern"><div data-fg-style="classic"><div id="a"></div></div>
      <div id="b"></div></div><div data-fg-style="modern"><div class="fg-style-classic"><div id="c"></div></div></div>`);

    expect(getStyleClassName(root.querySelector('#a'))).toBe('fg-style-classic');
    expect(getStyleClassName(root.querySelector('#b'))).toBe('fg-style-modern');
    expect(getStyleClassName(root.querySelector('#c'))).toBe('fg-style-classic');
    expect(getStyleClassName(root)).toBeNull();
  });

  it('gives a floating element the style of the grid, replacing the previous one', () => {
    const root = tree('<div data-fg-style="classic"><div id="grid"></div></div>');
    const floating = document.createElement('div');

    floating.classList.add('fg-style-modern');
    applyTheme(floating, root.querySelector('#grid'));

    expect([...floating.classList]).toEqual(['fg-style-classic']);
  });
});
