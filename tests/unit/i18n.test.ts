import { expect, test } from 'vitest';
import { errorText } from '@/lib/i18n';
test('processing failures use the selected language instead of the server fallback', () => {
  for (const code of ['llm_blocked', 'schema_empty', 'finalize_error']) {
    const english = errorText('en', code, 'Server fallback');
    for (const language of ['zh-CN', 'es', 'ja'] as const) {
      const text = errorText(language, code, 'Server fallback');
      expect(text).not.toBe(english);
      expect(text).not.toBe('Server fallback');
    }
  }
  expect(errorText('zh-CN', 'finalize_error')).toContain('JSON');
  expect(errorText('zh-CN', 'toString', 'Safe fallback')).toBe('Safe fallback');
});
