import type { MenuItem } from './../menuItem';
export const KEY = '---------';

const separatorItem = (): MenuItem => ({
  name: KEY,
});

export default separatorItem;
