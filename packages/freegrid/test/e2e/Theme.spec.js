describe('Theme', () => {
  const id = 'testContainer';
  const PROPERTIES = ['color', 'background-color', 'border-top-color', 'border-right-color', 'border-bottom-color',
    'border-left-color', 'font-family', 'font-size', 'box-shadow'];

  // One representative element per styled part (a pseudo-element where the part is drawn with ::after).
  const PARTS = {
    cell: ['.fg-master tbody td:not(.area):not(.current)'],
    colHeader: ['.fg-master thead th:not(.fg-highlight)'],
    activeColHeader: ['.fg-master thead th.fg-highlight'],
    selectionArea: ['.fg-master td.area', '::before'],
    currentBorder: ['.fg-master .fg-selection-border.current'],
    fillHandle: ['.fg-master .fg-selection-border.corner'],
    invalidCell: ['.fg-master td.fg-invalid'],
    readOnlyCell: ['.fg-master td.fg-dimmed'],
    commentIndicator: ['.fg-master td.fg-comment-cell', '::after'],
    mergedCell: ['.fg-master td[rowspan="2"]'],
    menu: ['.fg-context-menu .fg-master table'],
    menuItem: ['.fg-context-menu .fg-master td:not(.fg-separator):not(.fg-disabled):not(.current)'],
    menuItemHover: ['.fg-context-menu .fg-master td.current'],
    menuSeparator: ['.fg-context-menu .fg-master td.fg-separator'],
    menuDisabledItem: ['.fg-context-menu .fg-master td.fg-disabled'],
  };

  // Computed with today's CSS (before theming); identical in Chromium, Firefox and WebKit.
  const EXPECTED_LIGHT = {
    cell: {
      'color': 'rgb(0, 0, 0)',
      'background-color': 'rgb(255, 255, 255)',
      'border-top-color': 'rgb(204, 204, 204)',
      'border-right-color': 'rgb(204, 204, 204)',
      'border-bottom-color': 'rgb(204, 204, 204)',
      'border-left-color': 'rgb(204, 204, 204)',
      'font-family': 'sans-serif',
      'font-size': '16px',
      'box-shadow': 'none',
    },
    colHeader: {
      'color': 'rgb(34, 34, 34)',
      'background-color': 'rgb(240, 240, 240)',
      'border-top-color': 'rgb(204, 204, 204)',
      'border-right-color': 'rgb(204, 204, 204)',
      'border-bottom-color': 'rgb(204, 204, 204)',
      'border-left-color': 'rgb(204, 204, 204)',
      'font-family': 'sans-serif',
      'font-size': '16px',
      'box-shadow': 'none',
    },
    activeColHeader: {
      'color': 'rgb(34, 34, 34)',
      'background-color': 'rgb(220, 220, 220)',
      'border-top-color': 'rgb(204, 204, 204)',
      'border-right-color': 'rgb(204, 204, 204)',
      'border-bottom-color': 'rgb(204, 204, 204)',
      'border-left-color': 'rgb(34, 34, 34)',
      'font-family': 'sans-serif',
      'font-size': '16px',
      'box-shadow': 'none',
    },
    selectionArea: {
      'color': 'rgb(0, 0, 0)',
      'background-color': 'rgb(0, 94, 255)',
      'border-top-color': 'rgb(0, 0, 0)',
      'border-right-color': 'rgb(0, 0, 0)',
      'border-bottom-color': 'rgb(0, 0, 0)',
      'border-left-color': 'rgb(0, 0, 0)',
      'font-family': 'sans-serif',
      'font-size': '16px',
      'box-shadow': 'none',
    },
    currentBorder: {
      'color': 'rgb(0, 0, 0)',
      'background-color': 'rgb(75, 137, 255)',
      'border-top-color': 'rgb(0, 0, 0)',
      'border-right-color': 'rgb(0, 0, 0)',
      'border-bottom-color': 'rgb(0, 0, 0)',
      'border-left-color': 'rgb(0, 0, 0)',
      'font-family': 'sans-serif',
      'font-size': '0px',
      'box-shadow': 'none',
    },
    fillHandle: {
      'color': 'rgb(0, 0, 0)',
      'background-color': 'rgb(75, 137, 255)',
      'border-top-color': 'rgb(255, 255, 255)',
      'border-right-color': 'rgb(255, 255, 255)',
      'border-bottom-color': 'rgb(255, 255, 255)',
      'border-left-color': 'rgb(255, 255, 255)',
      'font-family': 'sans-serif',
      'font-size': '0px',
      'box-shadow': 'none',
    },
    invalidCell: {
      'color': 'rgb(0, 0, 0)',
      'background-color': 'rgb(255, 76, 66)',
      'border-top-color': 'rgb(204, 204, 204)',
      'border-right-color': 'rgb(204, 204, 204)',
      'border-bottom-color': 'rgb(204, 204, 204)',
      'border-left-color': 'rgb(0, 0, 0)',
      'font-family': 'sans-serif',
      'font-size': '16px',
      'box-shadow': 'none',
    },
    readOnlyCell: {
      'color': 'rgb(119, 119, 119)',
      'background-color': 'rgb(255, 255, 255)',
      'border-top-color': 'rgb(119, 119, 119)',
      'border-right-color': 'rgb(204, 204, 204)',
      'border-bottom-color': 'rgb(204, 204, 204)',
      'border-left-color': 'rgb(119, 119, 119)',
      'font-family': 'sans-serif',
      'font-size': '16px',
      'box-shadow': 'none',
    },
    commentIndicator: {
      'color': 'rgb(0, 0, 0)',
      'background-color': 'rgba(0, 0, 0, 0)',
      'border-top-color': 'rgb(0, 0, 0)',
      'border-right-color': 'rgb(0, 0, 0)',
      'border-bottom-color': 'rgb(0, 0, 0)',
      'border-left-color': 'rgba(0, 0, 0, 0)',
      'font-family': 'sans-serif',
      'font-size': '16px',
      'box-shadow': 'none',
    },
    mergedCell: {
      'color': 'rgb(0, 0, 0)',
      'background-color': 'rgb(255, 255, 255)',
      'border-top-color': 'rgb(0, 0, 0)',
      'border-right-color': 'rgb(204, 204, 204)',
      'border-bottom-color': 'rgb(204, 204, 204)',
      'border-left-color': 'rgb(204, 204, 204)',
      'font-family': 'sans-serif',
      'font-size': '16px',
      'box-shadow': 'none',
    },
    menu: {
      'color': 'rgb(0, 0, 0)',
      'background-color': 'rgba(0, 0, 0, 0)',
      'border-top-color': 'rgb(204, 204, 204)',
      'border-right-color': 'rgb(204, 204, 204)',
      'border-bottom-color': 'rgb(204, 204, 204)',
      'border-left-color': 'rgb(204, 204, 204)',
      'font-family': 'sans-serif',
      'font-size': '16px',
      'box-shadow': 'none',
    },
    menuItem: {
      'color': 'rgb(0, 0, 0)',
      'background-color': 'rgb(255, 255, 255)',
      'border-top-color': 'rgb(0, 0, 0)',
      'border-right-color': 'rgb(0, 0, 0)',
      'border-bottom-color': 'rgb(0, 0, 0)',
      'border-left-color': 'rgb(0, 0, 0)',
      'font-family': 'sans-serif',
      'font-size': '16px',
      'box-shadow': 'none',
    },
    menuItemHover: {
      'color': 'rgb(0, 0, 0)',
      'background-color': 'rgb(243, 243, 243)',
      'border-top-color': 'rgb(0, 0, 0)',
      'border-right-color': 'rgb(0, 0, 0)',
      'border-bottom-color': 'rgb(0, 0, 0)',
      'border-left-color': 'rgb(0, 0, 0)',
      'font-family': 'sans-serif',
      'font-size': '16px',
      'box-shadow': 'none',
    },
    menuSeparator: {
      'color': 'rgb(0, 0, 0)',
      'background-color': 'rgb(255, 255, 255)',
      'border-top-color': 'rgb(230, 230, 230)',
      'border-right-color': 'rgb(0, 0, 0)',
      'border-bottom-color': 'rgb(0, 0, 0)',
      'border-left-color': 'rgb(0, 0, 0)',
      'font-family': 'sans-serif',
      'font-size': '16px',
      'box-shadow': 'none',
    },
    menuDisabledItem: {
      'color': 'rgb(153, 153, 153)',
      'background-color': 'rgb(255, 255, 255)',
      'border-top-color': 'rgb(153, 153, 153)',
      'border-right-color': 'rgb(153, 153, 153)',
      'border-bottom-color': 'rgb(153, 153, 153)',
      'border-left-color': 'rgb(153, 153, 153)',
      'font-family': 'sans-serif',
      'font-size': '16px',
      'box-shadow': 'none',
    },
  };

  function collectThemeStyles() {
    const result = {};

    Object.keys(PARTS).forEach((part) => {
      const [selector, pseudo] = PARTS[part];
      const element = document.querySelector(selector);

      if (!element) {
        result[part] = null;

        return;
      }
      const style = getComputedStyle(element, pseudo || null);

      result[part] = {};
      PROPERTIES.forEach((property) => {
        result[part][property] = style.getPropertyValue(property);
      });
    });

    return result;
  }

  // A grid that shows every styled part at once: headers, a selection, an invalid and a read-only cell, a comment,
  // a merged cell, and an open context menu with a hovered, a disabled and a separator item. (Pikaday's CSS is not
  // loaded on the E2E page, so the date picker is checked by the dist tests instead.)
  async function createThemeFixture() {
    const hot = handsontable({
      data: Handsontable.helper.createSpreadsheetData(10, 5),
      colHeaders: true,
      rowHeaders: true,
      contextMenu: {
        items: {
          first: { name: 'First' },
          separator: '---------',
          disabledItem: { name: 'Disabled', disabled: true },
          last: { name: 'Last' },
        },
      },
      comments: true,
      mergeCells: [{ row: 3, col: 0, rowspan: 2, colspan: 2 }],
      cell: [
        { row: 2, col: 2, readOnly: true },
        { row: 1, col: 1, comment: { value: 'Note' } },
      ],
      columns: [{}, {}, {}, { validator: (value, callback) => callback(false) }, { type: 'date', dateFormat: 'MM/DD/YYYY' }],
    });

    await new Promise(resolve => hot.validateCells(resolve));
    hot.setDataAtCell(0, 4, '10/12/2026');

    selectCell(5, 1, 6, 3);
    contextMenu();
    // Hovering a menu item selects it in the menu's own grid (td.current).
    hot.getPlugin('contextMenu').menu.hotMenu.selectCell(0, 0);
    await sleep(50);

    return hot;
  }

  beforeEach(function() {
    this.$container = $(`<div id="${id}"></div>`).appendTo('body');
  });

  afterEach(function() {
    if (this.$container) {
      destroy();
      this.$container.remove();
    }
  });

  it('keeps today\'s light styles when no theme is set', async() => {
    await createThemeFixture();

    expect(collectThemeStyles()).toEqual(EXPECTED_LIGHT);
  });

  describe('on floating elements', () => {
    async function openFloatingParts(hot) {
      contextMenu();
      await sleep(50);
      // This grid's own elements: earlier specs may leave other floating elements in <body>.
      const menu = hot.getPlugin('contextMenu').menu.container;

      closeContextMenu();
      hot.getPlugin('comments').showAtCell(1, 1);
      const comments = hot.getPlugin('comments').editor.editor.parentNode;

      hot.getPlugin('comments').hide();
      selectCell(0, 4);
      keyDownUp('enter');
      await sleep(100);
      const datePicker = hot.getActiveEditor().datePicker;

      return { menu, comments, datePicker };
    }

    afterEach(() => {
      $('.theme-wrapper').remove();
      document.body.removeAttribute('data-fg-theme');
    });

    it('gives the context menu, comment editor and date picker the dark theme of an ancestor', async function() {
      this.$container.wrap('<div class="theme-wrapper fg-theme-dark"></div>');
      const hot = await createThemeFixture();

      expect(getComputedStyle(document.querySelector('.fg-master tbody td:not(.area):not(.current)'))['background-color'])
        .toBe('rgb(30, 30, 30)');

      closeContextMenu();
      const { menu, comments, datePicker } = await openFloatingParts(hot);

      expect(menu.classList.contains('fg-theme-dark')).toBe(true);
      expect(comments.classList.contains('fg-theme-dark')).toBe(true);
      expect(datePicker.classList.contains('fg-theme-dark')).toBe(true);
    });

    it('reads data-fg-theme on <body> too', async() => {
      document.body.setAttribute('data-fg-theme', 'dark');
      const hot = await createThemeFixture();

      closeContextMenu();
      const { menu } = await openFloatingParts(hot);

      expect(menu.classList.contains('fg-theme-dark')).toBe(true);
    });

    it('follows a theme change between two openings of the menu', async function() {
      this.$container.wrap('<div class="theme-wrapper fg-theme-dark"></div>');
      const hot = await createThemeFixture();

      expect(hot.getPlugin('contextMenu').menu.container.classList.contains('fg-theme-dark')).toBe(true);
      closeContextMenu();

      $('.theme-wrapper').removeClass('fg-theme-dark');
      contextMenu();
      await sleep(50);

      expect(hot.getPlugin('contextMenu').menu.container.classList.contains('fg-theme-dark')).toBe(false);
    });
  });
});
