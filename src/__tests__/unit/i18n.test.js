import { describe, it, expect, beforeEach } from 'vitest';
import { translate, resolveLanguage, translations, LANGUAGES } from '@/lib/i18n';

describe('i18n', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('exposes three languages', () => {
    expect(LANGUAGES.map(l => l.code)).toEqual(['en', 'lg', 'sw']);
  });

  it('translates known keys per language', () => {
    expect(translate('en', 'tabs.payments')).toBe('Payments');
    expect(translate('sw', 'tabs.payments')).toBe('Malipo');
    expect(translate('lg', 'tabs.payments')).toBe('Ensasula');
  });

  it('falls back to English then the key itself', () => {
    expect(translate('sw', 'nonexistent.key')).toBe('nonexistent.key');
  });

  it('every lg/sw key exists in en (no orphan translations)', () => {
    for (const lang of ['lg', 'sw']) {
      for (const key of Object.keys(translations[lang])) {
        expect(translations.en[key], `en missing key ${key} present in ${lang}`).toBeDefined();
      }
    }
  });

  it('lg and sw cover all en keys (no missing translations)', () => {
    for (const lang of ['lg', 'sw']) {
      for (const key of Object.keys(translations.en)) {
        expect(translations[lang][key], `${lang} missing key ${key}`).toBeDefined();
      }
    }
  });

  it('resolves language from customer preferred_language', () => {
    expect(resolveLanguage({ preferred_language: 'luganda' })).toBe('lg');
    expect(resolveLanguage({ preferred_language: 'swahili' })).toBe('sw');
    expect(resolveLanguage({ preferred_language: 'english' })).toBe('en');
    expect(resolveLanguage(null)).toBe('en');
  });

  it('localStorage override wins over customer preference', () => {
    localStorage.setItem('nlswms_lang', 'sw');
    expect(resolveLanguage({ preferred_language: 'luganda' })).toBe('sw');
  });
});
