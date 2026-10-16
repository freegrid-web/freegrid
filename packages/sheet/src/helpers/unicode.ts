export const KEY_CODES: Readonly<Record<string, number>> = {
  MOUSE_LEFT: 1,
  MOUSE_RIGHT: 3,
  MOUSE_MIDDLE: 2,
  BACKSPACE: 8,
  COMMA: 188,
  INSERT: 45,
  DELETE: 46,
  END: 35,
  ENTER: 13,
  ESCAPE: 27,
  CONTROL: 17,
  COMMAND_LEFT: 91,
  COMMAND_RIGHT: 93,
  COMMAND_FIREFOX: 224,
  ALT: 18,
  HOME: 36,
  PAGE_DOWN: 34,
  PAGE_UP: 33,
  PERIOD: 190,
  SPACE: 32,
  SHIFT: 16,
  CAPS_LOCK: 20,
  TAB: 9,
  ARROW_RIGHT: 39,
  ARROW_LEFT: 37,
  ARROW_UP: 38,
  ARROW_DOWN: 40,
  F1: 112,
  F2: 113,
  F3: 114,
  F4: 115,
  F5: 116,
  F6: 117,
  F7: 118,
  F8: 119,
  F9: 120,
  F10: 121,
  F11: 122,
  F12: 123,
  A: 65,
  B: 66,
  C: 67,
  D: 68,
  F: 70,
  I: 73,
  L: 76,
  O: 79,
  P: 80,
  S: 83,
  U: 85,
  V: 86,
  X: 88,
};

/**
 * Checks if a key code produces a printable character.
 */
export const isPrintableChar = (keyCode: number): boolean => ((keyCode === 32) || // space
    (keyCode >= 48 && keyCode <= 57) || // 0-9
    (keyCode >= 96 && keyCode <= 111) || // numpad
    (keyCode >= 186 && keyCode <= 192) || // ;=,-./`
    (keyCode >= 219 && keyCode <= 222) || // []{}\|"'
    keyCode >= 226 || // special chars (229 for Asian chars)
    (keyCode >= 65 && keyCode <= 90)); // a-z

const META_KEYS = [
  KEY_CODES.ARROW_DOWN,
  KEY_CODES.ARROW_UP,
  KEY_CODES.ARROW_LEFT,
  KEY_CODES.ARROW_RIGHT,
  KEY_CODES.HOME,
  KEY_CODES.END,
  KEY_CODES.DELETE,
  KEY_CODES.BACKSPACE,
  KEY_CODES.F1,
  KEY_CODES.F2,
  KEY_CODES.F3,
  KEY_CODES.F4,
  KEY_CODES.F5,
  KEY_CODES.F6,
  KEY_CODES.F7,
  KEY_CODES.F8,
  KEY_CODES.F9,
  KEY_CODES.F10,
  KEY_CODES.F11,
  KEY_CODES.F12,
  KEY_CODES.TAB,
  KEY_CODES.PAGE_DOWN,
  KEY_CODES.PAGE_UP,
  KEY_CODES.ENTER,
  KEY_CODES.ESCAPE,
  KEY_CODES.SHIFT,
  KEY_CODES.CAPS_LOCK,
  KEY_CODES.ALT,
];

/**
 * Checks if a key code is a navigation, editing or function key (arrows, Home/End, F1–F12, Enter, Escape, …).
 */
export const isMetaKey = (keyCode: number): boolean => META_KEYS.indexOf(keyCode) !== -1;

/**
 * Checks if a key code is the platform's control key (Command on macOS, Control elsewhere).
 */
export const isCtrlKey = (keyCode: number): boolean => {
  const keys = window.navigator.platform.includes('Mac')
    ? [KEY_CODES.COMMAND_LEFT, KEY_CODES.COMMAND_RIGHT, KEY_CODES.COMMAND_FIREFOX]
    : [KEY_CODES.CONTROL];

  return keys.includes(keyCode);
};

/**
 * Checks if a key code is Control or Command, on any platform.
 */
export const isCtrlMetaKey = (keyCode: number): boolean =>
  [KEY_CODES.CONTROL, KEY_CODES.COMMAND_LEFT, KEY_CODES.COMMAND_RIGHT, KEY_CODES.COMMAND_FIREFOX].includes(keyCode);

/**
 * Checks if a key code matches one of the `KEY_CODES` names in `baseCode` (`'ARROW_UP|ENTER'`).
 */
export const isKey = (keyCode: number, baseCode: string): boolean => baseCode.split('|').some(key => keyCode === KEY_CODES[key]);
