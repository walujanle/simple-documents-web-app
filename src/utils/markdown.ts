import DOMPurify from 'isomorphic-dompurify';
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
}).use(taskListPlugin);

DOMPurify.addHook('afterSanitizeAttributes', (node) => {
  if (node.nodeType !== 1) return;

  const element = node as Element;
  const tagName = element.tagName.toLowerCase();

  if (tagName === 'a') {
    const href = element.getAttribute('href');

    if (href && isExternalUrl(href)) {
      element.setAttribute('target', '_blank');
      element.setAttribute('rel', 'noopener noreferrer');
    }
  }

  if (tagName === 'img') {
    element.setAttribute('loading', 'lazy');
    element.setAttribute('decoding', 'async');
  }
});

export function parseMarkdown(markdown: string): string {
  if (!markdown) return '';

  const html = markdownRenderer.render(markdown);

  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS: [
      'a',
      'blockquote',
      'br',
      'code',
      'del',
      'em',
      'h1',
      'h2',
      'h3',
      'h4',
      'h5',
      'h6',
      'hr',
      'img',
      'input',
      'li',
      'ol',
      'p',
      'pre',
      's',
      'strong',
      'table',
      'tbody',
      'td',
      'th',
      'thead',
      'tr',
      'ul',
    ],
    ALLOWED_ATTR: [
      'alt',
      'checked',
      'class',
      'decoding',
      'disabled',
      'href',
      'loading',
      'rel',
      'src',
      'target',
      'title',
      'type',
    ],
    ADD_ATTR: ['checked', 'decoding', 'disabled', 'loading', 'rel', 'target'],
    ALLOWED_URI_REGEXP: /^(?:(?:https?|mailto):|\/(?!\/)|#)/i,
  });
}
