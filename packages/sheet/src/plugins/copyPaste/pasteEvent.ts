import ClipboardData from './clipboardData';

/** A stand-in for the browser's paste event, for `paste()` called from code. */
export default class PasteEvent {
  clipboardData = new ClipboardData();
}
