import * as Handsontable from 'handsontable';

const gridSettings: Handsontable.GridSettings = {
  valid: true,
  className: 'foo'
};

Handsontable.helper.arrayAvg([1, 3, 4]);
Handsontable.helper.arrayEach([1, 2, 3], (value, index, array) => {});
Handsontable.helper.arrayFilter([1, 'foo', true], (value, index, array) => {});
Handsontable.helper.arrayFlatten([1, 'foo', true]);
Handsontable.helper.arrayIncludes([1, 'foo', true], 'foo', 1);
Handsontable.helper.arrayMap([1, 'foo', true], (value, index, array) => {});
Handsontable.helper.arrayMax([1, 'foo', true]);
Handsontable.helper.arrayMin([1, 'foo', true]);
Handsontable.helper.arrayReduce([1, 'foo', true], (value, index, array) => {}, 'foo', false);
Handsontable.helper.arraySum([1, 'foo', true]);
Handsontable.helper.arrayUnique([1, 'foo', true]);
Handsontable.helper.cellMethodLookupFactory('foo', true);
Handsontable.helper.clone({key: 'foo'});
Handsontable.helper.columnFactory(gridSettings, [1, 'foo', true]);
Handsontable.helper.createEmptySpreadsheetData(0, 0);
Handsontable.helper.createObjectPropListener('foo', 'bar');
Handsontable.helper.createSpreadsheetData(0, 0);
Handsontable.helper.createSpreadsheetObjectData(0, 0);
Handsontable.helper.curry(() => {});
Handsontable.helper.curryRight(() => {});
Handsontable.helper.debounce(() => {}, 1);
Handsontable.helper.deepClone({key: 'foo'});
Handsontable.helper.deepExtend({key: 'foo'}, {key2: 'foo'});
Handsontable.helper.deepObjectSize({key: 'foo'});
Handsontable.helper.defineGetter({key: 'foo'}, 'key', 'bar', {});
Handsontable.helper.duckSchema({});
Handsontable.helper.endsWith('foo', 'bar');
Handsontable.helper.equalsIgnoreCase('foo', 'bar');
Handsontable.helper.extend({key: 'foo'}, {key2: 'foo'});
Handsontable.helper.extendArray([1, 'foo'], [true]);
Handsontable.helper.getComparisonFunction('en', {});
// The collator compares any values (numbers too), as the runtime does.
Handsontable.helper.getComparisonFunction()(1, 10);
Handsontable.helper.getNormalizedDate('YYYY-mm-dd');
Handsontable.helper.getProperty({key: 'foo'}, 'key');
Handsontable.helper.getPrototypeOf({key: 'foo'});
Handsontable.helper.inherit({key: 'foo'}, {key2: 'bar'});
Handsontable.helper.isChrome();
Handsontable.helper.isCtrlKey(1);
Handsontable.helper.isDefined(1);
Handsontable.helper.isEmpty(1);
Handsontable.helper.isFunction(1);
Handsontable.helper.isKey(1, 'foo');
Handsontable.helper.isMetaKey(1);
Handsontable.helper.isMobileBrowser();
Handsontable.helper.isNumeric(true);
Handsontable.helper.isObject('foo');
Handsontable.helper.isObjectEqual([1, 2, 3], {});
Handsontable.helper.isPercentValue('1');
Handsontable.helper.isPrintableChar(1);
Handsontable.helper.isSafari();
Handsontable.helper.isTouchSupported();
Handsontable.helper.isUndefined(null);
Handsontable.helper.mixin({}, {key: 'foo'}, {key2: 'bar'});
Handsontable.helper.objectEach({key: 'foo'}, (value, key, object) => {});
Handsontable.helper.padStart('foo', 1, 'bar');
Handsontable.helper.partial(() => {}, 1, 'foo', true);
Handsontable.helper.pipe(() => {}, () => {});
Handsontable.helper.pivot([1, 'foo', true]);
Handsontable.helper.randomString();
Handsontable.helper.rangeEach(0, 0, (index) => {});
Handsontable.helper.rangeEachReverse(0, 0, (index) => {});
Handsontable.helper.spreadsheetColumnIndex('foo');
Handsontable.helper.spreadsheetColumnLabel(1);
Handsontable.helper.startsWith('foo', 'bar');
Handsontable.helper.stringify(1);
Handsontable.helper.stripTags('<a>foo</a>');
Handsontable.helper.substitute('foo', {});
Handsontable.helper.throttle(() => {}, 1);
Handsontable.helper.throttleAfterHits(() => {}, 0, 1);
Handsontable.helper.to2dArray([1, 'foo', true]);
Handsontable.helper.toUpperCaseFirst('foo');
Handsontable.helper.translateRowsToColumns([1, 'foo', true]);
Handsontable.helper.valueAccordingPercent(1, 90);

// Removed in 0.1 (IE and polyfill-era helpers, see CHANGELOG).
// @ts-expect-error
Handsontable.helper.isIE();
// @ts-expect-error
Handsontable.helper.isIE8();
// @ts-expect-error
Handsontable.helper.isIE9();
// @ts-expect-error
Handsontable.helper.isEdge();
// @ts-expect-error
Handsontable.helper.isMSBrowser();
// @ts-expect-error
Handsontable.helper.isWebComponentSupportedNatively();
// @ts-expect-error
Handsontable.helper.hasCaptionProblem();
// @ts-expect-error
Handsontable.helper.requestAnimationFrame(() => {});
// @ts-expect-error
Handsontable.helper.cancelAnimationFrame(1);
