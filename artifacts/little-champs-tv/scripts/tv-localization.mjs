import fs from 'node:fs';
import path from 'node:path';
import { tvMessages } from './tv-messages.mjs';

export const languages = ['de','en','fr','es','pt','sv','ja','zh','ko'];
const root = path.resolve(import.meta.dirname, '../../..');
function flatten(value, prefix = '', result = {}) {
  for (const [key, item] of Object.entries(value)) {
    if (typeof item === 'string') result[prefix + key] = item;
    else if (item && typeof item === 'object') flatten(item, prefix + key + '.', result);
  }
  return result;
}

// Read the app's existing translations at build time, not in the TV runtime.
// Only messages actually used by TV source code are bundled.
export function createTvCatalog() {
  const shared = Object.fromEntries(languages.map(lang => [lang, flatten(JSON.parse(
    fs.readFileSync(path.join(root, `artifacts/little-champs/src/locales/${lang}/translation.json`), 'utf8'),
  ))]));
  const catalog = {};
  const source = [
    'src/App.tsx','src/components/tv-rewards.tsx','src/components/tv-task-card.tsx',
    'src/components/tv-task-board.tsx','src/components/tv-shopping-list-dialog.tsx',
    'src/components/error-boundary.tsx','src/hooks/use-tv-data.ts','src/lib/tv-task-feedback.ts',
    'src/lib/tv-language.ts',
  ].map(file => fs.readFileSync(path.join(root, 'artifacts/little-champs-tv', file), 'utf8')).join('\n');
  for (const [key, german] of Object.entries(shared.de)) {
    if (key.startsWith('skinNames.')) {
      const names = languages.map(lang => shared[lang][key]);
      if (names.every(value => typeof value === 'string' && value.length)) catalog[key] = names;
      continue;
    }
    if (!german || german.includes('{{') || !source.includes(german) || catalog[german]) continue;
    const values = languages.map(lang => shared[lang][key]);
    if (values.every(value => typeof value === 'string' && value.length)) catalog[german] = values;
  }
  for (const row of tvMessages) {
    if (row.length !== languages.length) throw new Error(`Incomplete TV translation: ${row[0]}`);
    const placeholders = text => [...text.matchAll(/\{(\d+)\}/g)].map(match => match[1]).sort().join(',');
    if (row.some(text => !text || placeholders(text) !== placeholders(row[0]))) {
      throw new Error(`TV translation placeholders differ: ${row[0]}`);
    }
    catalog[row[0]] = row;
  }
  return catalog;
}

/**
 * A source-only translation macro: translate known UI literals, never values
 * supplied by the API (task titles, custom categories, names, descriptions).
 * JSX and JavaScript templates retain their interpolation expressions.
 */
export function tvTranslationMacro(catalog) {
  return function ({ types: b }) {
    return {
      name: 'little-champs-tv-ui-translations',
      visitor: {
        Program: {
          enter(p, state) {
            const file = state.file.opts.filename.replace(/\\/g, '/');
            state.tvEnabled = /little-champs-tv\/src\/(App\.tsx|components\/(tv-[^/]+|error-boundary)\.tsx|hooks\/use-tv-data\.ts|lib\/tv-task-feedback\.ts)$/.test(file) && !/\.test\./.test(file);
            state.tvUsed = false;
          },
          exit(p, state) {
            if (!state.tvUsed) return;
            const from = state.file.opts.filename.endsWith('/App.tsx') ? './lib/tv-language' : '../lib/tv-language';
            p.unshiftContainer('body', b.importDeclaration([
              b.importSpecifier(b.identifier('__tvT'), b.identifier('tvText')),
              b.importSpecifier(b.identifier('__tvValue'), b.identifier('tvTextValue')),
              b.importSpecifier(b.identifier('__tvLocale'), b.identifier('tvLocale')),
            ], b.stringLiteral(from)));
          },
        },
        JSXExpressionContainer(p, state) {
          if (!state.tvEnabled || !b.isIdentifier(p.node.expression) || !['notice','error'].includes(p.node.expression.name)) return;
          state.tvUsed = true;
          p.node.expression = b.callExpression(b.identifier('__tvValue'), [p.node.expression]);
          p.skip();
        },
        JSXElement: {
          enter(p, state) {
            if (!state.tvEnabled) return;
            const values = [];
            let key = '';
            for (const child of p.node.children) {
              if (b.isJSXText(child)) key += child.value;
              else if (b.isJSXExpressionContainer(child) && !b.isJSXEmptyExpression(child.expression)) {
                key += `{${values.length}}`;
                values.push(child.expression);
              } else return;
            }
            key = key.replace(/\s+/g,' ').trim();
            if (!values.length || !catalog[key]) return;
            state.tvUsed = true;
            p.node.children = [b.jsxExpressionContainer(b.callExpression(b.identifier('__tvT'), [b.stringLiteral(key), b.arrayExpression(values)]))];
          },
        },
        JSXText(p, state) {
          if (!state.tvEnabled) return;
          const raw = p.node.value;
          const key = raw.replace(/\s+/g, ' ').trim();
          if (!catalog[key]) return;
          state.tvUsed = true;
          const nodes = [];
          if (/^\s/.test(raw)) nodes.push(b.jsxText(' '));
          nodes.push(b.jsxExpressionContainer(b.callExpression(b.identifier('__tvT'), [b.stringLiteral(key)])));
          if (/\s$/.test(raw)) nodes.push(b.jsxText(' '));
          p.replaceWithMultiple(nodes);
          p.skip();
        },
        StringLiteral(p, state) {
          if (!state.tvEnabled || !p.getFunctionParent()) return;
          if (p.parentPath.isCallExpression() && ['tvText','__tvT','tvTextValue','__tvValue'].includes(p.parent.callee.name)) return;
          if (p.findParent(parent => parent.isImportDeclaration())) return;
          if (p.parentPath.isObjectProperty() && p.key === 'key') return;
          if (p.parentPath.isJSXAttribute() && !['alt','title','aria-label','placeholder','detail','action'].includes(p.parent.name.name)) return;
          const key = p.node.value;
          if (key !== 'de-DE' && !catalog[key]) return;
          state.tvUsed = true;
          const call = b.callExpression(b.identifier(key === 'de-DE' ? '__tvLocale' : '__tvT'), key === 'de-DE' ? [] : [b.stringLiteral(key)]);
          p.replaceWith(p.parentPath.isJSXAttribute() ? b.jsxExpressionContainer(call) : call);
          p.skip();
        },
        TemplateLiteral: {
          exit(p, state) {
            if (!state.tvEnabled || !p.getFunctionParent() || p.parentPath.isTaggedTemplateExpression()) return;
            const key = p.node.quasis.map((q,i) => q.value.cooked + (i < p.node.expressions.length ? `{${i}}` : '')).join('');
            if (!catalog[key]) return;
            state.tvUsed = true;
            p.replaceWith(b.callExpression(b.identifier('__tvT'), [b.stringLiteral(key), b.arrayExpression(p.node.expressions)]));
            p.skip();
          },
        },
        MemberExpression(p, state) {
          if (!state.tvEnabled || p.node.computed) return;
          const property = p.node.property.name;
          const object = p.node.object;
          const storedMessage = b.isIdentifier(object) && (
            (['dialog','modal'].includes(object.name) && ['title','message','detail'].includes(property))
            || property === 'message'
            || property === 'error' && object.name === 'image'
          );
          const nestedError = property === 'message' && b.isMemberExpression(object);
          if ((!storedMessage && !nestedError) || p.parentPath.isCallExpression() && p.parent.callee.name === '__tvValue') return;
          state.tvUsed = true;
          p.replaceWith(b.callExpression(b.identifier('__tvValue'), [p.node]));
          p.skip();
        },
      },
    };
  };
}
