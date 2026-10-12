import { objectEach } from './object';

const tester = (testerFunc) => {
  const result = {
    value: false,
  };
  result.test = (ua, vendor) => {
    result.value = testerFunc(ua, vendor);
  };

  return result;
};

const browsers = {
  chrome: tester((ua, vendor) => /Chrome/.test(ua) && /Google/.test(vendor)),
  mobile: tester(ua => /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(ua)),
  safari: tester((ua, vendor) => /Safari/.test(ua) && /Apple Computer/.test(vendor)),
};

export function setBrowserMeta({ userAgent = navigator.userAgent, vendor = navigator.vendor } = {}) {
  objectEach(browsers, ({ test }) => void test(userAgent, vendor));
}

setBrowserMeta();

export function isChrome() {
  return browsers.chrome.value;
}

export function isMobileBrowser() {
  return browsers.mobile.value;
}

export function isSafari() {
  return browsers.safari.value;
}
