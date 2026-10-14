type Tester = {
  value: boolean;
  test(ua: string, vendor: string): void;
};

const tester = (testerFunc: (ua: string, vendor: string) => boolean): Tester => {
  const result: Tester = {
    value: false,
    test(ua, vendor) {
      result.value = testerFunc(ua, vendor);
    },
  };

  return result;
};

const browsers = {
  chrome: tester((ua, vendor) => /Chrome/.test(ua) && /Google/.test(vendor)),
  mobile: tester(ua => /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(ua)),
  safari: tester((ua, vendor) => /Safari/.test(ua) && /Apple Computer/.test(vendor)),
};

/**
 * Detects the browser from a user agent and vendor (the current browser's by default). Tests call it with
 * other values.
 */
export const setBrowserMeta = ({ userAgent = navigator.userAgent, vendor = navigator.vendor } = {}): void => {
  Object.values(browsers).forEach(({ test }) => test(userAgent, vendor));
};

setBrowserMeta();

/**
 * Checks if the browser is Chrome.
 */
export const isChrome = (): boolean => browsers.chrome.value;

/**
 * Checks if the browser is a mobile browser.
 */
export const isMobileBrowser = (): boolean => browsers.mobile.value;

/**
 * Checks if the browser is Safari.
 */
export const isSafari = (): boolean => browsers.safari.value;
