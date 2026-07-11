import MarkdownIt from 'markdown-it';

type MarkdownToken = {
  type: string;
  content: string;
  children: MarkdownToken[] | null;
  attrGet(name: string): string | null;
  attrJoin(name: string, value: string): void;
  attrSet(name: string, value: string): void;
};

type MarkdownStateCore = {
  tokens: MarkdownToken[];
  Token: new (type: string, tag: string, nesting: 1 | 0 | -1) => MarkdownToken;
};

const isExternalUrl = (href: string): boolean => /^https?:\/\//i.test(href);
const isSafeUrl = (url: string): boolean => /^(?:(?:https?|mailto):|\/(?!\/)|#)/i.test(url);

const taskListPlugin = (md: MarkdownIt): void => {
  md.core.ruler.after('inline', 'task_lists', (state: MarkdownStateCore) => {
    for (let index = 2; index < state.tokens.length; index += 1) {
      const token = state.tokens[index];
      const listItemToken = state.tokens[index - 2];

      if (token.type !== 'inline' || listItemToken?.type !== 'list_item_open') {
        continue;
      }

      const firstTextToken = token.children?.find((child) => child.type === 'text');
      const taskMarker = firstTextToken?.content.match(/^\[([ xX])]\s+/);

      if (!firstTextToken || !taskMarker) {
        continue;
      }

      const checkboxToken = new state.Token('html_inline', '', 0);
      const isChecked = taskMarker[1].toLowerCase() === 'x';
      checkboxToken.content = `<input class="task-list-item-checkbox" type="checkbox" disabled${isChecked ? ' checked' : ''}> `;
      firstTextToken.content = firstTextToken.content.slice(taskMarker[0].length);
      token.children?.unshift(checkboxToken);
      listItemToken.attrJoin('class', 'task-list-item');
    }
  });
};

const markdownRenderer = new MarkdownIt({
  html: false,
  linkify: true,
  typographer: false,
  breaks: false,
});

markdownRenderer.validateLink = isSafeUrl;
markdownRenderer.use(taskListPlugin);

const defaultLinkOpen =
  markdownRenderer.renderer.rules.link_open ??
  ((tokens, idx, options, _env, self) => self.renderToken(tokens, idx, options));
const defaultImage =
  markdownRenderer.renderer.rules.image ??
  ((tokens, idx, options, _env, self) => self.renderToken(tokens, idx, options));

markdownRenderer.renderer.rules.link_open = (tokens, idx, options, env, self) => {
  const href = tokens[idx].attrGet('href');
  if (href && isExternalUrl(href)) {
    tokens[idx].attrSet('target', '_blank');
    tokens[idx].attrSet('rel', 'noopener noreferrer');
  }
  return defaultLinkOpen(tokens, idx, options, env, self);
};

markdownRenderer.renderer.rules.image = (tokens, idx, options, env, self) => {
  const src = tokens[idx].attrGet('src');
  if (!src || !isSafeUrl(src)) return '';
  tokens[idx].attrSet('loading', 'lazy');
  tokens[idx].attrSet('decoding', 'async');
  return defaultImage(tokens, idx, options, env, self);
};

export function parseMarkdown(markdown: string): string {
  if (!markdown) return '';

  return markdownRenderer.render(markdown);
}
