---
api: [Localization]
---

# Localization

The built-in UI (for example the context menu) is in English (`en-US`) by default. FreeSheet includes 15 more
languages: `de-CH`, `de-DE`, `es-MX`, `fr-FR`, `it-IT`, `ja-JP`, `ko-KR`, `lv-LV`, `nb-NO`, `nl-NL`, `pl-PL`,
`pt-BR`, `ru-RU`, `zh-CN` and `zh-TW`.

Load a language, then select it with the `language` setting:

```js
import FreeSheet from '@freegrid/sheet';
import '@freegrid/sheet/languages/de-DE'; // or '@freegrid/sheet/languages/all'

new FreeSheet(container, { data, contextMenu: true, language: 'de-DE' });
```

With `<script>` tags, load `dist/languages/de-DE.js` (or `all.js`) after the grid script.

## Your own language

Register a dictionary that maps phrase keys to text. Keys you leave out fall back to English:

```js
const C = FreeSheet.languages.dictionaryKeys;

FreeSheet.languages.registerLanguageDictionary({
  languageCode: 'lt-LT',
  [C.CONTEXTMENU_ITEMS_ROW_ABOVE]: 'Įterpti eilutę aukščiau',
  [C.CONTEXTMENU_ITEMS_ROW_BELOW]: 'Įterpti eilutę žemiau',
});
```

Contributions of new languages are welcome.
