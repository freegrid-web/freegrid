import sideItem from './side';
import noBorders from './noBorders';
import type CustomBorders from './../customBorders';
import type { MenuItem } from './../../contextMenu/menuItem';

/** The context menu entries for the borders of the selected cells. */
const top = (plugin: CustomBorders): MenuItem => sideItem(plugin, 'top');
const right = (plugin: CustomBorders): MenuItem => sideItem(plugin, 'right');
const bottom = (plugin: CustomBorders): MenuItem => sideItem(plugin, 'bottom');
const left = (plugin: CustomBorders): MenuItem => sideItem(plugin, 'left');

export {
  bottom,
  left,
  noBorders,
  right,
  top,
};
