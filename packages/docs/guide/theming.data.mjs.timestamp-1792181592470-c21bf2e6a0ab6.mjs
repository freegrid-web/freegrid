// guide/theming.data.mjs
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
var __vite_injected_original_import_meta_url = "file:///home/mindaugas/Projects/excel/packages/docs/guide/theming.data.mjs";
var file = fileURLToPath(new URL("../../sheet/src/css/variables.css", __vite_injected_original_import_meta_url));
function declarations(body) {
  const result = [];
  let group = "";
  body.split("\n").forEach((line) => {
    const heading = line.match(/\/\* == (.+?) == \*\//);
    if (heading) {
      group = heading[1];
      return;
    }
    const match = line.match(/^\s*(--fs-[\w-]+):\s*(.+?);\s*(?:\/\*\s*(.+?)\s*\*\/)?\s*$/);
    if (match) {
      result.push({ group, name: match[1], value: match[2], description: match[3] || "" });
    }
  });
  return result;
}
var STYLE_GROUPS = [
  [/^--fs-header-/, "Headers"],
  [/^--fs-selection-/, "Selection"],
  [/^--fs-editor-/, "Editors"],
  [/^--fs-menu-/, "Context menu"],
  [/^--fs-datepicker-/, "Date picker"]
];
var theming_data_default = {
  watch: [file],
  load() {
    const css = readFileSync(file, "utf8").replace(/\/\*[\s\S]*?\*\//g, (comment) => /[{}]/.test(comment) ? "" : comment);
    const rules = [...css.matchAll(/([^{}]*)\{([^{}]*)\}/g)].map(([, selector, body]) => ({ selector: selector.replace(/\/\*[\s\S]*?\*\//g, "").trim(), body }));
    const find = (predicate) => declarations(rules.find(predicate)?.body || "");
    const unstyle = (declaration) => ({ ...declaration, name: declaration.name.replace(/^--fs-style-/, "--fs-") });
    const root = find(({ selector }) => selector === ":where(:root)");
    const styleDefaults = find(({ selector }) => selector.startsWith(":where(:root,")).map(unstyle);
    const modern = new Map(find(({ selector }) => selector.startsWith(":where(.fs-style-modern")).map(unstyle).map(({ name, value }) => [name, value]));
    const dark = new Map(find(({ selector }) => selector.includes("fs-theme-dark")).map(({ name, value }) => [name, value]));
    const shown = (value) => value.replace(
      /var\((--fs-[\w-]+), var\(--fs-style-[\w-]+(?:, ([^()]+))?\)\)/g,
      (match, name, fallback) => fallback ? `var(${name}, ${fallback})` : `var(${name})`
    );
    const row = ({ name, value, description }) => ({
      name,
      description,
      light: shown(value),
      modern: modern.get(name) && modern.get(name) !== value ? modern.get(name) : "",
      dark: dark.get(name) || ""
    });
    const isColor = ({ name }) => /^--fs-color-/.test(name);
    const rootBase = root.filter(({ group }) => !group);
    const lightBase = [...rootBase.filter(isColor), ...styleDefaults.filter(isColor), ...rootBase.filter((d) => !isColor(d))];
    const unsetBase = [["--fs-color-text", "Text color."], ["--fs-font-family", "Font family."], ["--fs-font-size", "Font size."]].map(([name, description]) => ({ name, description, light: "(page)", modern: modern.get(name) || "", dark: dark.get(name) || "" }));
    const components = [
      ...root.filter(({ group }) => group),
      ...find(({ selector }) => selector.startsWith(":where(.freesheet")),
      ...styleDefaults.filter((declaration) => !isColor(declaration)).map((declaration) => ({ ...declaration, group: STYLE_GROUPS.find(([pattern]) => pattern.test(declaration.name))?.[1] || "" }))
    ];
    const groups = [];
    components.forEach((declaration) => {
      let group = groups.find(({ name }) => name === declaration.group);
      if (!group) {
        group = { name: declaration.group, rows: [] };
        groups.push(group);
      }
      group.rows.push(row(declaration));
    });
    return { base: [...lightBase.map(row), ...unsetBase], groups };
  }
};
export {
  theming_data_default as default
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiZ3VpZGUvdGhlbWluZy5kYXRhLm1qcyJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiY29uc3QgX192aXRlX2luamVjdGVkX29yaWdpbmFsX2Rpcm5hbWUgPSBcIi9ob21lL21pbmRhdWdhcy9Qcm9qZWN0cy9leGNlbC9wYWNrYWdlcy9kb2NzL2d1aWRlXCI7Y29uc3QgX192aXRlX2luamVjdGVkX29yaWdpbmFsX2ZpbGVuYW1lID0gXCIvaG9tZS9taW5kYXVnYXMvUHJvamVjdHMvZXhjZWwvcGFja2FnZXMvZG9jcy9ndWlkZS90aGVtaW5nLmRhdGEubWpzXCI7Y29uc3QgX192aXRlX2luamVjdGVkX29yaWdpbmFsX2ltcG9ydF9tZXRhX3VybCA9IFwiZmlsZTovLy9ob21lL21pbmRhdWdhcy9Qcm9qZWN0cy9leGNlbC9wYWNrYWdlcy9kb2NzL2d1aWRlL3RoZW1pbmcuZGF0YS5tanNcIjsvLyBSZWFkcyBGcmVlU2hlZXQncyB0aGVtZSB2YXJpYWJsZXMgZnJvbSBwYWNrYWdlcy9zaGVldC9zcmMvY3NzL3ZhcmlhYmxlcy5jc3MgYXQgZG9jcyBidWlsZCB0aW1lLCBzbyB0aGUgVGhlbWluZ1xuLy8gcGFnZSBhbHdheXMgbGlzdHMgZXhhY3RseSB3aGF0IHRoZSBzdHlsZXNoZWV0IGRlZmluZXMuXG5pbXBvcnQgeyByZWFkRmlsZVN5bmMgfSBmcm9tICdub2RlOmZzJztcbmltcG9ydCB7IGZpbGVVUkxUb1BhdGggfSBmcm9tICdub2RlOnVybCc7XG5cbmNvbnN0IGZpbGUgPSBmaWxlVVJMVG9QYXRoKG5ldyBVUkwoJy4uLy4uL3NoZWV0L3NyYy9jc3MvdmFyaWFibGVzLmNzcycsIGltcG9ydC5tZXRhLnVybCkpO1xuXG4vLyBcIi0tZnMtbmFtZTogdmFsdWU7IC8qIGRlc2NyaXB0aW9uICovXCIgZGVjbGFyYXRpb25zIG9mIGEgcnVsZSBib2R5LCB3aXRoIHRoZSBcIi8qID09IEdyb3VwID09ICovXCIgdGhleSBmb2xsb3cuXG5mdW5jdGlvbiBkZWNsYXJhdGlvbnMoYm9keSkge1xuICBjb25zdCByZXN1bHQgPSBbXTtcbiAgbGV0IGdyb3VwID0gJyc7XG5cbiAgYm9keS5zcGxpdCgnXFxuJykuZm9yRWFjaCgobGluZSkgPT4ge1xuICAgIGNvbnN0IGhlYWRpbmcgPSBsaW5lLm1hdGNoKC9cXC9cXCogPT0gKC4rPykgPT0gXFwqXFwvLyk7XG5cbiAgICBpZiAoaGVhZGluZykge1xuICAgICAgZ3JvdXAgPSBoZWFkaW5nWzFdO1xuICAgICAgcmV0dXJuO1xuICAgIH1cbiAgICBjb25zdCBtYXRjaCA9IGxpbmUubWF0Y2goL15cXHMqKC0tZnMtW1xcdy1dKyk6XFxzKiguKz8pO1xccyooPzpcXC9cXCpcXHMqKC4rPylcXHMqXFwqXFwvKT9cXHMqJC8pO1xuXG4gICAgaWYgKG1hdGNoKSB7XG4gICAgICByZXN1bHQucHVzaCh7IGdyb3VwLCBuYW1lOiBtYXRjaFsxXSwgdmFsdWU6IG1hdGNoWzJdLCBkZXNjcmlwdGlvbjogbWF0Y2hbM10gfHwgJycgfSk7XG4gICAgfVxuICB9KTtcblxuICByZXR1cm4gcmVzdWx0O1xufVxuXG4vLyBUaGUgY29sb3JzIGFuZCB0aGUgZm9udCB0aGF0IGRpZmZlciBiZXR3ZWVuIENsYXNzaWMgYW5kIE1vZGVybiBhcmUgc3R5bGUgZGVmYXVsdHMgKC0tZnMtc3R5bGUtKik6IHRoZXkgYXJlIHNob3duXG4vLyBhcyB0aGUgdmFsdWUgb2YgdGhlIGJhc2Ugb3IgY29tcG9uZW50IHZhcmlhYmxlIHRoZXkgc3RhbmQgaW4gZm9yLlxuY29uc3QgU1RZTEVfR1JPVVBTID0gW1xuICBbL14tLWZzLWhlYWRlci0vLCAnSGVhZGVycyddLFxuICBbL14tLWZzLXNlbGVjdGlvbi0vLCAnU2VsZWN0aW9uJ10sXG4gIFsvXi0tZnMtZWRpdG9yLS8sICdFZGl0b3JzJ10sXG4gIFsvXi0tZnMtbWVudS0vLCAnQ29udGV4dCBtZW51J10sXG4gIFsvXi0tZnMtZGF0ZXBpY2tlci0vLCAnRGF0ZSBwaWNrZXInXSxcbl07XG5cbmV4cG9ydCBkZWZhdWx0IHtcbiAgd2F0Y2g6IFtmaWxlXSxcbiAgbG9hZCgpIHtcbiAgICAvLyBDb21tZW50cyBhcmUga2VwdCAodGhleSBob2xkIHRoZSBkZXNjcmlwdGlvbnMgYW5kIHRoZSBncm91cCBoZWFkaW5ncyksIGV4Y2VwdCB0aG9zZSB3aXRoIGJyYWNlcywgc3VjaCBhcyB0aGVcbiAgICAvLyB1c2FnZSBleGFtcGxlcyBpbiB0aGUgZmlsZSBoZWFkZXIsIHdoaWNoIHdvdWxkIGxvb2sgbGlrZSBydWxlcy5cbiAgICBjb25zdCBjc3MgPSByZWFkRmlsZVN5bmMoZmlsZSwgJ3V0ZjgnKS5yZXBsYWNlKC9cXC9cXCpbXFxzXFxTXSo/XFwqXFwvL2csIGNvbW1lbnQgPT4gKC9be31dLy50ZXN0KGNvbW1lbnQpID8gJycgOiBjb21tZW50KSk7XG4gICAgY29uc3QgcnVsZXMgPSBbLi4uY3NzLm1hdGNoQWxsKC8oW157fV0qKVxceyhbXnt9XSopXFx9L2cpXVxuICAgICAgLm1hcCgoWywgc2VsZWN0b3IsIGJvZHldKSA9PiAoeyBzZWxlY3Rvcjogc2VsZWN0b3IucmVwbGFjZSgvXFwvXFwqW1xcc1xcU10qP1xcKlxcLy9nLCAnJykudHJpbSgpLCBib2R5IH0pKTtcbiAgICBjb25zdCBmaW5kID0gcHJlZGljYXRlID0+IGRlY2xhcmF0aW9ucyhydWxlcy5maW5kKHByZWRpY2F0ZSk/LmJvZHkgfHwgJycpO1xuICAgIGNvbnN0IHVuc3R5bGUgPSBkZWNsYXJhdGlvbiA9PiAoeyAuLi5kZWNsYXJhdGlvbiwgbmFtZTogZGVjbGFyYXRpb24ubmFtZS5yZXBsYWNlKC9eLS1mcy1zdHlsZS0vLCAnLS1mcy0nKSB9KTtcbiAgICAvLyA6cm9vdCBoYXMgdGhlIGJhc2UgdmFyaWFibGVzIChiZWZvcmUgdGhlIGZpcnN0IGdyb3VwIGhlYWRpbmcpIGFuZCB0aGUgY29tcG9uZW50IHZhcmlhYmxlcyB3aXRoIHRoZWlyIG93blxuICAgIC8vIHZhbHVlOyB0aGUgZ3JpZCdzIHBhcnRzIGhhdmUgdGhlIGNvbXBvbmVudCB2YXJpYWJsZXMgdGhhdCBmb2xsb3cgYSBiYXNlIHZhcmlhYmxlLlxuICAgIGNvbnN0IHJvb3QgPSBmaW5kKCh7IHNlbGVjdG9yIH0pID0+IHNlbGVjdG9yID09PSAnOndoZXJlKDpyb290KScpO1xuICAgIGNvbnN0IHN0eWxlRGVmYXVsdHMgPSBmaW5kKCh7IHNlbGVjdG9yIH0pID0+IHNlbGVjdG9yLnN0YXJ0c1dpdGgoJzp3aGVyZSg6cm9vdCwnKSkubWFwKHVuc3R5bGUpO1xuICAgIGNvbnN0IG1vZGVybiA9IG5ldyBNYXAoZmluZCgoeyBzZWxlY3RvciB9KSA9PiBzZWxlY3Rvci5zdGFydHNXaXRoKCc6d2hlcmUoLmZzLXN0eWxlLW1vZGVybicpKVxuICAgICAgLm1hcCh1bnN0eWxlKS5tYXAoKHsgbmFtZSwgdmFsdWUgfSkgPT4gW25hbWUsIHZhbHVlXSkpO1xuICAgIGNvbnN0IGRhcmsgPSBuZXcgTWFwKGZpbmQoKHsgc2VsZWN0b3IgfSkgPT4gc2VsZWN0b3IuaW5jbHVkZXMoJ2ZzLXRoZW1lLWRhcmsnKSlcbiAgICAgIC5tYXAoKHsgbmFtZSwgdmFsdWUgfSkgPT4gW25hbWUsIHZhbHVlXSkpO1xuICAgIC8vIHZhcigtLWZzLWNvbG9yLWJvcmRlciwgdmFyKC0tZnMtc3R5bGUtY29sb3ItYm9yZGVyKSkgaXMgc2hvd24gYXMgdmFyKC0tZnMtY29sb3ItYm9yZGVyKS5cbiAgICBjb25zdCBzaG93biA9IHZhbHVlID0+IHZhbHVlLnJlcGxhY2UoL3ZhclxcKCgtLWZzLVtcXHctXSspLCB2YXJcXCgtLWZzLXN0eWxlLVtcXHctXSsoPzosIChbXigpXSspKT9cXClcXCkvZyxcbiAgICAgIChtYXRjaCwgbmFtZSwgZmFsbGJhY2spID0+IChmYWxsYmFjayA/IGB2YXIoJHtuYW1lfSwgJHtmYWxsYmFja30pYCA6IGB2YXIoJHtuYW1lfSlgKSk7XG4gICAgY29uc3Qgcm93ID0gKHsgbmFtZSwgdmFsdWUsIGRlc2NyaXB0aW9uIH0pID0+ICh7XG4gICAgICBuYW1lLFxuICAgICAgZGVzY3JpcHRpb24sXG4gICAgICBsaWdodDogc2hvd24odmFsdWUpLFxuICAgICAgbW9kZXJuOiBtb2Rlcm4uZ2V0KG5hbWUpICYmIG1vZGVybi5nZXQobmFtZSkgIT09IHZhbHVlID8gbW9kZXJuLmdldChuYW1lKSA6ICcnLFxuICAgICAgZGFyazogZGFyay5nZXQobmFtZSkgfHwgJycsXG4gICAgfSk7XG4gICAgY29uc3QgaXNDb2xvciA9ICh7IG5hbWUgfSkgPT4gL14tLWZzLWNvbG9yLS8udGVzdChuYW1lKTtcbiAgICBjb25zdCByb290QmFzZSA9IHJvb3QuZmlsdGVyKCh7IGdyb3VwIH0pID0+ICFncm91cCk7XG4gICAgY29uc3QgbGlnaHRCYXNlID0gWy4uLnJvb3RCYXNlLmZpbHRlcihpc0NvbG9yKSwgLi4uc3R5bGVEZWZhdWx0cy5maWx0ZXIoaXNDb2xvciksIC4uLnJvb3RCYXNlLmZpbHRlcihkID0+ICFpc0NvbG9yKGQpKV07XG4gICAgY29uc3QgdW5zZXRCYXNlID0gW1snLS1mcy1jb2xvci10ZXh0JywgJ1RleHQgY29sb3IuJ10sIFsnLS1mcy1mb250LWZhbWlseScsICdGb250IGZhbWlseS4nXSwgWyctLWZzLWZvbnQtc2l6ZScsICdGb250IHNpemUuJ11dXG4gICAgICAubWFwKChbbmFtZSwgZGVzY3JpcHRpb25dKSA9PiAoeyBuYW1lLCBkZXNjcmlwdGlvbiwgbGlnaHQ6ICcocGFnZSknLCBtb2Rlcm46IG1vZGVybi5nZXQobmFtZSkgfHwgJycsIGRhcms6IGRhcmsuZ2V0KG5hbWUpIHx8ICcnIH0pKTtcbiAgICBjb25zdCBjb21wb25lbnRzID0gW1xuICAgICAgLi4ucm9vdC5maWx0ZXIoKHsgZ3JvdXAgfSkgPT4gZ3JvdXApLFxuICAgICAgLi4uZmluZCgoeyBzZWxlY3RvciB9KSA9PiBzZWxlY3Rvci5zdGFydHNXaXRoKCc6d2hlcmUoLmZyZWVzaGVldCcpKSxcbiAgICAgIC4uLnN0eWxlRGVmYXVsdHMuZmlsdGVyKGRlY2xhcmF0aW9uID0+ICFpc0NvbG9yKGRlY2xhcmF0aW9uKSlcbiAgICAgICAgLm1hcChkZWNsYXJhdGlvbiA9PiAoeyAuLi5kZWNsYXJhdGlvbiwgZ3JvdXA6IFNUWUxFX0dST1VQUy5maW5kKChbcGF0dGVybl0pID0+IHBhdHRlcm4udGVzdChkZWNsYXJhdGlvbi5uYW1lKSk/LlsxXSB8fCAnJyB9KSksXG4gICAgXTtcbiAgICBjb25zdCBncm91cHMgPSBbXTtcblxuICAgIGNvbXBvbmVudHMuZm9yRWFjaCgoZGVjbGFyYXRpb24pID0+IHtcbiAgICAgIGxldCBncm91cCA9IGdyb3Vwcy5maW5kKCh7IG5hbWUgfSkgPT4gbmFtZSA9PT0gZGVjbGFyYXRpb24uZ3JvdXApO1xuXG4gICAgICBpZiAoIWdyb3VwKSB7XG4gICAgICAgIGdyb3VwID0geyBuYW1lOiBkZWNsYXJhdGlvbi5ncm91cCwgcm93czogW10gfTtcbiAgICAgICAgZ3JvdXBzLnB1c2goZ3JvdXApO1xuICAgICAgfVxuICAgICAgZ3JvdXAucm93cy5wdXNoKHJvdyhkZWNsYXJhdGlvbikpO1xuICAgIH0pO1xuXG4gICAgcmV0dXJuIHsgYmFzZTogWy4uLmxpZ2h0QmFzZS5tYXAocm93KSwgLi4udW5zZXRCYXNlXSwgZ3JvdXBzIH07XG4gIH0sXG59O1xuIl0sCiAgIm1hcHBpbmdzIjogIjtBQUVBLFNBQVMsb0JBQW9CO0FBQzdCLFNBQVMscUJBQXFCO0FBSGdMLElBQU0sMkNBQTJDO0FBSy9QLElBQU0sT0FBTyxjQUFjLElBQUksSUFBSSxxQ0FBcUMsd0NBQWUsQ0FBQztBQUd4RixTQUFTLGFBQWEsTUFBTTtBQUMxQixRQUFNLFNBQVMsQ0FBQztBQUNoQixNQUFJLFFBQVE7QUFFWixPQUFLLE1BQU0sSUFBSSxFQUFFLFFBQVEsQ0FBQyxTQUFTO0FBQ2pDLFVBQU0sVUFBVSxLQUFLLE1BQU0sdUJBQXVCO0FBRWxELFFBQUksU0FBUztBQUNYLGNBQVEsUUFBUSxDQUFDO0FBQ2pCO0FBQUEsSUFDRjtBQUNBLFVBQU0sUUFBUSxLQUFLLE1BQU0sNERBQTREO0FBRXJGLFFBQUksT0FBTztBQUNULGFBQU8sS0FBSyxFQUFF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
