import { describe, expect, test } from 'bun:test';
import { parseMarkdown } from '../src/utils/markdown';

describe('markdown safety', () => {
  test('does not render raw HTML', () => {
    const html = parseMarkdown('<script>alert(1)</script>\n\nHello');
    expect(html).not.toContain('<script>');
    expect(html).toContain('Hello');
  });

  test('does not create javascript: anchors', () => {
    const html = parseMarkdown('[x](javascript:alert(1))');
    expect(html).not.toContain('href="javascript:');
    expect(html).not.toContain("href='javascript:");
  });

  test('allows https links with rel noopener', () => {
    const html = parseMarkdown('[x](https://example.com)');
    expect(html).toContain('https://example.com');
    expect(html).toContain('noopener');
  });
});
