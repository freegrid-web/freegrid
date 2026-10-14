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
    const root = tree(`<div class="fs-style-modern"><div data-fs-style="classic"><div id="a"></div></div>
      <div id="b"></div></div><div data-fs-style="modern"><div class="fs-style-classic"><div id="c"></div></div></div>`);

    expect(getStyleClassName(root.querySelector('#a'))).toBe('fs-style-classic');
    expect(getStyleClassName(root.querySelector('#b'))).toBe('fs-style-modern');
    expect(getStyleClassName(root.querySelector('#c'))).toBe('fs-style-classic');
    expect(getStyleClassName(root)).toBeNull();
  });

  it('gives a floating element the style of the grid, replacing the previous one', () => {
    const root = tree('<div data-fs-style="classic"><div id="grid"></div></div>');
    const floating = document.createElement('div');

    floating.classList.add('fs-style-modern');
    applyTheme(floating, root.querySelector('#grid'));

    expect([...floating.classList]).toEqual(['fs-style-classic']);
  });
});
