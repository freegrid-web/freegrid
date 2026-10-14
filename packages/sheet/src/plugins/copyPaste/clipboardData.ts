/** A stand-in for the browser's DataTransfer, for paste events made by `paste()`. */
export default class ClipboardData {
  data: Record<string, string> = {};

  setData(type: string, value: string): void {
    this.data[type] = value;
  }

  getData(type: string): string | undefined {
    return this.data[type] || undefined;
  }
}
