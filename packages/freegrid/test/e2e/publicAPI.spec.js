describe('Public API', () => {
  const id = 'testContainer';

  beforeEach(function() {
    this.$container = $(`<div id="${id}"></div>`).appendTo('body');
  });

  afterEach(function() {
    if (this.$container) {
      destroy();
      this.$container.remove();
    }
  });

  describe('Plugins', () => {
    it('should expose static method for registering external plugins', () => {
      expect(Handsontable.plugins.registerPlugin).toBeFunction();
    });

    it('should expose BasePlugin class', () => {
      expect(Handsontable.plugins.BasePlugin).toBeFunction();
    });

    it('should expose all registered plugin classes', () => {
      expect(Handsontable.plugins.AutoColumnSize).toBeFunction();
      expect(Handsontable.plugins.AutoRowSize).toBeFunction();
      expect(Handsontable.plugins.ColumnSorting).toBeFunction();
      expect(Handsontable.plugins.Comments).toBeFunction();
      expect(Handsontable.plugins.ContextMenu).toBeFunction();
      expect(Handsontable.plugins.CopyPaste).toBeFunction();
      expect(Handsontable.plugins.CustomBorders).toBeFunction();
      expect(Handsontable.plugins.DragToScroll).toBeFunction();
      expect(Handsontable.plugins.ManualColumnFreeze).toBeFunction();
      expect(Handsontable.plugins.ManualColumnResize).toBeFunction();
      expect(Handsontable.plugins.ManualRowResize).toBeFunction();
      expect(Handsontable.plugins.MultipleSelectionHandles).toBeFunction();
      expect(Handsontable.plugins.TouchScroll).toBeFunction();
      expect(Handsontable.plugins.UndoRedo).toBeFunction();
    });
  });

  describe('Editors', () => {
    it('should expose static method for registering external editors', () => {
      expect(Handsontable.editors.registerEditor).toBeFunction();
    });

    it('should expose static method for retrieving registered editors', () => {
      expect(Handsontable.editors.getEditor).toBeFunction();
    });

    it('should expose BaseEditor class', () => {
      expect(Handsontable.editors.EditorBase).toBeFunction();
    });

    it('should expose all registered editor classes', () => {
      expect(Handsontable.editors.EditorAutocomplete).toBeFunction();
      expect(Handsontable.editors.EditorCheckbox).toBeFunction();
      expect(Handsontable.editors.EditorDate).toBeFunction();
      expect(Handsontable.editors.EditorDropdown).toBeFunction();
      expect(Handsontable.editors.EditorHandsontable).toBeFunction();
      expect(Handsontable.editors.EditorNumeric).toBeFunction();
      expect(Handsontable.editors.EditorPassword).toBeFunction();
      expect(Handsontable.editors.EditorSelect).toBeFunction();
      expect(Handsontable.editors.EditorText).toBeFunction();
    });
  });

  describe('Renderers', () => {
    it('should expose static method for registering external renderers', () => {
      expect(Handsontable.renderers.registerRenderer).toBeFunction();
    });

    it('should expose static method for retrieving registered renderers', () => {
      expect(Handsontable.renderers.getRenderer).toBeFunction();
    });

    it('should expose BaseRenderer class', () => {
      expect(Handsontable.renderers.RendererBase).toBeFunction();
    });

    it('should expose all registered renderer functions', () => {
      expect(Handsontable.renderers.RendererAutocomplete).toBeFunction();
      expect(Handsontable.renderers.RendererCheckbox).toBeFunction();
      expect(Handsontable.renderers.RendererHtml).toBeFunction();
      expect(Handsontable.renderers.RendererNumeric).toBeFunction();
      expect(Handsontable.renderers.RendererPassword).toBeFunction();
      expect(Handsontable.renderers.RendererText).toBeFunction();
    });
  });

  describe('Validators', () => {
    it('should expose static method for registering external validators', () => {
      expect(Handsontable.validators.registerValidator).toBeFunction();
    });

    it('should expose static method for retrieving registered validators', () => {
      expect(Handsontable.validators.getValidator).toBeFunction();
    });

    it('should expose all registered validator functions', () => {
      expect(Handsontable.validators.ValidatorAutocomplete).toBeFunction();
      expect(Handsontable.validators.ValidatorDate).toBeFunction();
      expect(Handsontable.validators.ValidatorNumeric).toBeFunction();
      expect(Handsontable.validators.ValidatorTime).toBeFunction();
    });
  });

  describe('Names before 0.3.0', () => {
    it('should not expose the old editor, renderer and validator names', () => {
      ['BaseEditor', 'TextEditor', 'AutocompleteEditor', 'DateEditor', 'HandsontableEditor'].forEach((name) => {
        expect(Handsontable.editors[name]).toBeUndefined();
      });
      ['BaseRenderer', 'TextRenderer', 'cellDecorator'].forEach((name) => {
        expect(Handsontable.renderers[name]).toBeUndefined();
      });
      ['DateValidator', 'NumericValidator'].forEach((name) => {
        expect(Handsontable.validators[name]).toBeUndefined();
      });
    });
  });

  describe('CellTypes', () => {
    it('should expose static method for registering external cell types', () => {
      expect(Handsontable.cellTypes.registerCellType).toBeFunction();
    });

    it('should expose static method for retrieving registered cell types', () => {
      expect(Handsontable.cellTypes.getCellType).toBeFunction();
    });

    it('should expose all registered cell type objects', () => {
      expect(Handsontable.cellTypes.autocomplete.editor).toBe(Handsontable.editors.EditorAutocomplete);
      expect(Handsontable.cellTypes.autocomplete.renderer).toBe(Handsontable.renderers.RendererAutocomplete);
      expect(Handsontable.cellTypes.autocomplete.validator).toBe(Handsontable.validators.ValidatorAutocomplete);

      expect(Handsontable.cellTypes.checkbox.editor).toBe(Handsontable.editors.EditorCheckbox);
      expect(Handsontable.cellTypes.checkbox.renderer).toBe(Handsontable.renderers.RendererCheckbox);
      expect(Handsontable.cellTypes.checkbox.validator).not.toBeDefined();

      expect(Handsontable.cellTypes.date.editor).toBe(Handsontable.editors.EditorDate);
      expect(Handsontable.cellTypes.date.renderer).toBe(Handsontable.renderers.RendererAutocomplete);
      expect(Handsontable.cellTypes.date.validator).toBe(Handsontable.validators.ValidatorDate);

      expect(Handsontable.cellTypes.dropdown.editor).toBe(Handsontable.editors.EditorDropdown);
      expect(Handsontable.cellTypes.dropdown.renderer).toBe(Handsontable.renderers.RendererAutocomplete);
      expect(Handsontable.cellTypes.dropdown.validator).toBe(Handsontable.validators.ValidatorAutocomplete);

      expect(Handsontable.cellTypes.handsontable.editor).toBe(Handsontable.editors.EditorHandsontable);
      expect(Handsontable.cellTypes.handsontable.renderer).toBe(Handsontable.renderers.RendererAutocomplete);
      expect(Handsontable.cellTypes.handsontable.validator).not.toBeDefined();

      expect(Handsontable.cellTypes.numeric.editor).toBe(Handsontable.editors.EditorNumeric);
      expect(Handsontable.cellTypes.numeric.renderer).toBe(Handsontable.renderers.RendererNumeric);
      expect(Handsontable.cellTypes.numeric.validator).toBe(Handsontable.validators.ValidatorNumeric);

      expect(Handsontable.cellTypes.password.editor).toBe(Handsontable.editors.EditorPassword);
      expect(Handsontable.cellTypes.password.renderer).toBe(Handsontable.renderers.RendererPassword);
      expect(Handsontable.cellTypes.password.validator).not.toBeDefined();

      expect(Handsontable.cellTypes.text.editor).toBe(Handsontable.editors.EditorText);
      expect(Handsontable.cellTypes.text.renderer).toBe(Handsontable.renderers.RendererText);
      expect(Handsontable.cellTypes.text.validator).not.toBeDefined();

      expect(Handsontable.cellTypes.time.editor).toBe(Handsontable.editors.EditorText);
      expect(Handsontable.cellTypes.time.renderer).toBe(Handsontable.renderers.RendererText);
      expect(Handsontable.cellTypes.time.validator).toBe(Handsontable.validators.ValidatorTime);
    });
  });

  describe('Helpers', () => {
    it('should expose all registered helpers', () => {
      expect(Handsontable.dom.addClass).toBeFunction();
      expect(Handsontable.dom.addEvent).toBeFunction();
      expect(Handsontable.dom.closest).toBeFunction();
      expect(Handsontable.dom.closestDown).toBeFunction();
      expect(Handsontable.dom.empty).toBeFunction();
      expect(Handsontable.dom.fastInnerHTML).toBeFunction();
      expect(Handsontable.dom.fastInnerText).toBeFunction();
      expect(Handsontable.dom.getCaretPosition).toBeFunction();
      expect(Handsontable.dom.getComputedStyle).toBeFunction();
      expect(Handsontable.dom.getCssTransform).toBeFunction();
      expect(Handsontable.dom.getParent).toBeFunction();
      expect(Handsontable.dom.getScrollLeft).toBeFunction();
      expect(Handsontable.dom.getScrollTop).toBeFunction();
      expect(Handsontable.dom.getScrollableElement).toBeFunction();
      expect(Handsontable.dom.getScrollbarWidth).toBeFunction();
      expect(Handsontable.dom.getSelectionEndPosition).toBeFunction();
      expect(Handsontable.dom.getSelectionText).toBeFunction();
      expect(Handsontable.dom.getStyle).toBeFunction();
      expect(Handsontable.dom.getTrimmingContainer).toBeFunction();
      expect(Handsontable.dom.getWindowScrollLeft).toBeFunction();
      expect(Handsontable.dom.getWindowScrollTop).toBeFunction();
      expect(Handsontable.dom.hasClass).toBeFunction();
      expect(Handsontable.dom.hasHorizontalScrollbar).toBeFunction();
      expect(Handsontable.dom.hasVerticalScrollbar).toBeFunction();
      expect(Handsontable.dom.index).toBeFunction();
      expect(Handsontable.dom.innerHeight).toBeFunction();
      expect(Handsontable.dom.innerWidth).toBeFunction();
      expect(Handsontable.dom.isChildOf).toBeFunction();
      expect(Handsontable.dom.isChildOfWebComponentTable).toBeFunction();
      expect(Handsontable.dom.isImmediatePropagationStopped).toBeFunction();
      expect(Handsontable.dom.isInput).toBeFunction();
      expect(Handsontable.dom.isLeftClick).toBeFunction();
      expect(Handsontable.dom.isRightClick).toBeFunction();
      expect(Handsontable.dom.isVisible).toBeFunction();
      expect(Handsontable.dom.offset).toBeFunction();
      expect(Handsontable.dom.outerHeight).toBeFunction();
      expect(Handsontable.dom.outerWidth).toBeFunction();
      expect(Handsontable.dom.overlayContainsElement).toBeFunction();
      expect(Handsontable.dom.pageX).toBeFunction();
      expect(Handsontable.dom.pageY).toBeFunction();
      expect(Handsontable.dom.polymerUnwrap).toBeFunction();
      expect(Handsontable.dom.polymerWrap).toBeFunction();
      expect(Handsontable.dom.removeClass).toBeFunction();
      expect(Handsontable.dom.removeEvent).toBeFunction();
      expect(Handsontable.dom.removeTextNodes).toBeFunction();
      expect(Handsontable.dom.resetCssTransform).toBeFunction();
      expect(Handsontable.dom.setCaretPosition).toBeFunction();
      expect(Handsontable.dom.setOverlayPosition).toBeFunction();
      expect(Handsontable.dom.stopImmediatePropagation).toBeFunction();
      expect(Handsontable.dom.stopPropagation).toBeFunction();
    });
  });
});
