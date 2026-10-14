describe('cellTypes', () => {
  const id = 'testContainer';
  const {
    registerCellType,
    getCellType,
  } = Handsontable.cellTypes;
  const {
    getEditor,
    EditorBase,
  } = Handsontable.editors;
  const {
    getRenderer,
  } = Handsontable.renderers;
  const {
    getValidator,
  } = Handsontable.validators;

  beforeEach(function() {
    this.$container = $(`<div id="${id}"></div>`).appendTo('body');
  });

  afterEach(function() {
    if (this.$container) {
      destroy();
      this.$container.remove();
    }
  });

  it('should register custom cell type (with custom editor, renderer and validator)', async() => {
    class MyEditor extends EditorBase {
      init() {
        this.TEXTAREA = document.createElement('TEXTAREA');
        this.TEXTAREA_PARENT = document.createElement('DIV');

        this.TEXTAREA_PARENT.appendChild(this.TEXTAREA);
        this.instance.rootElement.appendChild(this.TEXTAREA_PARENT);
      }
      getValue() {
        return `**${this.TEXTAREA.value}**`;
      }
      setValue(value) {
        this.TEXTAREA.value = value;
      }
      open() {}
      close() {}
      focus() {
        this.TEXTAREA.focus();
      }
    }
    registerCellType('myCellType', {
      editor: MyEditor,
      renderer: (hot, td, row, col, prop, value) => {
        td.innerHTML = `--${value}--`;
      },
      validator: (value, cb) => {
        cb(value === 10);
      }
    });

    const onAfterValidate = jasmine.createSpy('onAfterValidate');
    const hot = handsontable({
      data: [
        [1, 6, 10],
      ],
      columns: [{
        type: 'myCellType',
      }],
      afterValidate: onAfterValidate
    });

    hot.setDataAtCell(1, 0, 10);

    await sleep(100);

    expect(onAfterValidate).toHaveBeenCalledWith(true, 10, 1, 0, undefined, undefined);
    expect(getCell(1, 0).innerHTML).toBe('--10--');

    selectCell(0, 0);
    keyDown('enter');
    document.activeElement.value = 'hello';
    destroyEditor();

    await sleep(100);

    expect(onAfterValidate).toHaveBeenCalledWith(false, '**hello**', 0, 0, 'edit', undefined);
    expect(getCell(0, 0).innerHTML).toBe('--**hello**--');
  });

  it('should retrieve predefined cell types by its names', () => {
    const { editors, renderers, validators } = Handsontable;

    expect(getCellType('autocomplete').editor).toBe(editors.EditorAutocomplete);
    expect(getCellType('autocomplete').renderer).toBe(renderers.RendererAutocomplete);
    expect(getCellType('autocomplete').validator).toBe(validators.ValidatorAutocomplete);

    expect(getCellType('checkbox').editor).toBe(editors.EditorCheckbox);
    expect(getCellType('checkbox').renderer).toBe(renderers.RendererCheckbox);
    expect(getCellType('checkbox').validator).not.toBeDefined();

    expect(getCellType('date').editor).toBe(editors.EditorDate);
    expect(getCellType('date').renderer).toBe(renderers.RendererAutocomplete);
    expect(getCellType('date').validator).toBe(validators.ValidatorDate);

    expect(getCellType('dropdown').editor).toBe(editors.EditorDropdown);
    expect(getCellType('dropdown').renderer).toBe(renderers.RendererAutocomplete);
    expect(getCellType('dropdown').validator).toBe(validators.ValidatorAutocomplete);

    expect(getCellType('handsontable').editor).toBe(editors.EditorHandsontable);
    expect(getCellType('handsontable').renderer).toBe(renderers.RendererAutocomplete);
    expect(getCellType('handsontable').validator).not.toBeDefined();

    expect(getCellType('numeric').editor).toBe(editors.EditorNumeric);
    expect(getCellType('numeric').renderer).toBe(renderers.RendererNumeric);
    expect(getCellType('numeric').validator).toBe(validators.ValidatorNumeric);
    expect(getCellType('numeric').dataType).toBe('number');

    expect(getCellType('password').editor).toBe(editors.EditorPassword);
    expect(getCellType('password').renderer).toBe(renderers.RendererPassword);
    expect(getCellType('password').validator).not.toBeDefined();
    expect(getCellType('password').copyable).toBe(false);

    expect(getCellType('text').editor).toBe(editors.EditorText);
    expect(getCellType('text').renderer).toBe(renderers.RendererText);
    expect(getCellType('text').validator).not.toBeDefined();

    expect(getCellType('time').editor).toBe(editors.EditorText);
    expect(getCellType('time').renderer).toBe(renderers.RendererText);
    expect(getCellType('time').validator).toBe(validators.ValidatorTime);
  });

  it('should register custom cell type into renderers, editors and validators', () => {
    class MyEditor {}
    function myRenderer() {}
    function myValidator() {}

    registerCellType('myCellType', {
      editor: MyEditor,
      renderer: myRenderer,
      validator: myValidator,
    });

    expect(getEditor('myCellType')).toBe(MyEditor);
    expect(getRenderer('myCellType')).toBe(myRenderer);
    expect(getValidator('myCellType')).toBe(myValidator);
  });

  it('should overwrite cell types under the same name', () => {
    class MyEditor {}
    function myRenderer() {}
    function myValidator() {}

    registerCellType('myCellType', {
      editor: MyEditor,
      renderer: myRenderer,
      validator: myValidator,
    });

    expect(getEditor('myCellType')).toBe(MyEditor);
    expect(getRenderer('myCellType')).toBe(myRenderer);
    expect(getValidator('myCellType')).toBe(myValidator);

    function myRenderer2() {}
    function myValidator2() {}

    registerCellType('myCellType', {
      renderer: myRenderer2,
      validator: myValidator2,
    });

    expect(getEditor('myCellType')).toBe(MyEditor);
    expect(getRenderer('myCellType')).toBe(myRenderer2);
    expect(getValidator('myCellType')).toBe(myValidator2);
  });

  it('should retrieve custom cell type by its names', () => {
    class MyEditor {}
    function myRenderer() {}
    function myValidator() {}

    registerCellType('myCellType', {
      editor: MyEditor,
      renderer: myRenderer,
      validator: myValidator,
    });

    expect(getCellType('myCellType').editor).toBe(MyEditor);
    expect(getCellType('myCellType').renderer).toBe(myRenderer);
    expect(getCellType('myCellType').validator).toBe(myValidator);
  });
});
