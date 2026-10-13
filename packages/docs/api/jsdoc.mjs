// Reads FreeGrid's JSDoc comments for the API reference (see api.data.mjs). Only what the reference shows is kept:
// description, parameters, return value, examples, and the deprecated/since/private markers.

const BLOCK = /\/\*\*([\s\S]*?)\*\//g;
const PAGES = { Core: 'methods', Hooks: 'events', Options: 'settings' };

/** The anchor of an entry: `getData` → `getdata`, `ColumnSorting#sort` → `columnsorting-sort`. */
export const anchor = name => name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

const linkTo = (target, text) => {
  const [owner, member] = target.split('#');

  if (!member) {
    return text || owner;
  }
  if (PAGES[owner]) {
    const label = text || (owner === 'Core' ? `${member}()` : member);

    return `[${label}](./${PAGES[owner]}#${anchor(member)})`;
  }

  return `[${text || `${owner}.${member}()`}](./plugins#${anchor(`${owner}-${member}`)})`;
};

// Upstream links to its documentation were replaced with links to the repository; they lead nowhere useful.
const PLACEHOLDER = '\\]\\(https://github\\.com/freegrid-web/freegrid\\)';
const SEE_DOCS = new RegExp(`(^|[.!?][ \\t]+|\\n)[ \\t]*(See|You can read more|See more|Read more)[^.\\n]*${PLACEHOLDER}[^.\\n]*\\.[ \\t]*`, 'g');
const PLACEHOLDER_LINK = new RegExp(`\\[([^\\]]+)${PLACEHOLDER}`, 'g');

// Upstream wording and links: FreeGrid's own name; links to other sites keep only their text.
const clean = text => text
  .replace(/\[(Core|Hooks|Options)#(\w+)\]\(https?:[^)]*\)/g, (match, owner, member) => linkTo(`${owner}#${member}`))
  .replace(SEE_DOCS, '$1')
  .replace(PLACEHOLDER_LINK, '$1')
  .replace(/[ \t]+\n/g, '\n')
  .replace(/\[([^\]]+)\]\{@link\s+([^}\s]+)\s*\}/g, (match, label, target) => (/^https?:/.test(target) ? label : linkTo(target, label)))
  .replace(/\{@link\s+([^}\s]+)(?:\s+([^}]*))?\}/g, (match, target, label) => (/^https?:/.test(target) ? (label || '') : linkTo(target, label)))
  .replace(/Handsontable/g, 'FreeGrid');

// Markdown text: paragraphs and lists stay; 4+ spaces of indentation (which markdown would show as code) go.
const prose = lines => clean(lines
  .map(line => line.replace(/\s+$/, ''))
  .map(line => (/^ {4,}/.test(line) ? line.trimStart() : line))
  .join('\n')
  .replace(/\n{3,}/g, '\n\n')
  .trim());

const parseParam = (text) => {
  const match = /^\{([^}]*)\}\s*(\[[^\]]*\]|\S+)\s*([\s\S]*)$/.exec(text.trim());

  if (!match) {
    return null;
  }
  const [, type, rawName, description] = match;
  const optional = rawName.startsWith('[');
  const [name, value] = optional ? rawName.slice(1, -1).split('=') : [rawName];

  return { name: name.trim(), type, optional, default: value?.trim(), description: clean(description.replace(/\s+/g, ' ').trim()) };
};

/**
 * Parses one comment's text (without the `/**` and `*\/`).
 */
export const parseBlock = (text) => {
  const lines = text.split('\n').map(line => line.replace(/^\s*\*? ?/, ''));
  const description = [];
  const tags = [];

  lines.forEach((line) => {
    const tag = /^@(\w+)\s?(.*)$/.exec(line);

    if (tag) {
      tags.push({ tag: tag[1], lines: tag[2] ? [tag[2]] : [] });
    } else if (tags.length) {
      tags[tags.length - 1].lines.push(line);
    } else {
      description.push(line);
    }
  });
  const block = { description: prose(description), params: [], examples: [], private: false };

  tags.forEach(({ tag, lines: tagLines }) => {
    const text_ = tagLines.join('\n');

    switch (tag) {
      case 'description':
        block.description = prose(tagLines);
        break;
      case 'memberof':
        block.owner = text_.trim().replace(/#$/, '');
        break;
      case 'function':
      case 'method':
        block.kind = 'method';
        block.name = text_.trim();
        break;
      case 'event': {
        const [owner, name] = text_.trim().split('#');

        block.kind = 'event';
        block.owner = owner;
        block.name = name;
        break;
      }
      case 'param': {
        const param = parseParam(tagLines.join(' '));

        if (param) {
          block.params.push(param);
        }
        break;
      }
      case 'returns':
      case 'return': {
        const match = /^\{([^}]*)\}\s*([\s\S]*)$/.exec(tagLines.join(' ').trim());

        block.returns = match ? { type: match[1], description: prose([match[2]]) } : { type: '', description: prose(tagLines) };
        break;
      }
      case 'example':
        block.examples.push(clean(text_.replace(/^\n+|\s+$/g, '')));
        break;
      case 'type':
        block.type = text_.trim().replace(/^\{|\}$/g, '');
        break;
      case 'default':
        block.default = text_.trim();
        break;
      case 'private':
        block.private = true;
        break;
      case 'deprecated':
        block.deprecated = prose(tagLines) || true;
        break;
      case 'since':
        block.since = text_.trim();
        break;
      default:
    }
  });

  return block;
};

/**
 * Every JSDoc comment of `source`.
 */
export const parseBlocks = source => [...source.matchAll(BLOCK)].map(([, text]) => parseBlock(text));

/**
 * The settings of defaultSettings.js: each comment followed by `name: value,`. The default is `@default` or the value.
 */
export const readSettings = source => [...source.matchAll(/\/\*\*([\s\S]*?)\*\/\s*\n\s*(\w+)\s*:\s*([^\n]*)/g)]
  .map(([, text, name, value]) => {
    const block = parseBlock(text);
    const shown = value.trim().replace(/,$/, '');

    return {
      ...block,
      kind: 'setting',
      name,
      default: block.default ?? (shown === 'void 0' ? 'undefined' : shown),
    };
  })
  .filter(setting => !setting.private);

/**
 * A plugin's file: the `@plugin` comment (name, description, examples) and the class's public methods (the comments
 * followed by `  name(…) {`). `null` when the file has no `@plugin` comment.
 */
export const readPlugin = (source) => {
  const headerText = [...source.matchAll(BLOCK)].map(([, text]) => text).find(text => /@plugin\s+\w+/.test(text));

  if (!headerText) {
    return null;
  }
  const header = parseBlock(headerText);
  const name = /@plugin\s+(\w+)/.exec(headerText)[1];
  const methods = [...source.matchAll(/\/\*\*([\s\S]*?)\*\/\s*\n {2}(?:static\s+)?(\w+)\s*\(/g)]
    .map(([, text, method]) => ({ ...parseBlock(text), kind: 'method', owner: name, name: method }))
    .filter(method => !method.private && method.name !== 'constructor');

  return { ...header, kind: 'plugin', name, methods };
};
