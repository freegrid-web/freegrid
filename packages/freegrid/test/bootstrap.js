import './helpers/custom-matchers';

jasmine.DEFAULT_TIMEOUT_INTERVAL = 15000;

beforeEach(() => {
  if (document.activeElement && document.activeElement !== document.body) {
    document.activeElement.blur();

  } else if (!document.activeElement) { // IE
    document.body.focus();
  }
});

afterEach(() => {
  (window.scrollTo || window.scrollTo(0, 0));
});
