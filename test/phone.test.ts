// The four real formats from the live board are the fixtures
// (docs/INTEGRATIONS.md — "Phone numbers — the real formats").
import { describe, expect, it } from 'vitest';
import { normalizePhone } from '../src/domain/phone.js';

describe('normalizePhone', () => {
  it('local Israeli number, no country code', () => {
    expect(normalizePhone('0533325770')).toBe('+972533325770');
  });

  it('country code without the +', () => {
    expect(normalizePhone('972509089908')).toBe('+972509089908');
  });

  it('proper E.164 passes through', () => {
    expect(normalizePhone('+972527541119')).toBe('+972527541119');
  });

  it('the empty-object case from the board is rejected', () => {
    expect(normalizePhone({ phone: '', changed_at: '...', countryShortName: null })).toBeNull();
  });

  it('rejects rather than guesses', () => {
    expect(normalizePhone('')).toBeNull();
    expect(normalizePhone(null)).toBeNull();
    expect(normalizePhone(undefined)).toBeNull();
    expect(normalizePhone('not a phone')).toBeNull();
    expect(normalizePhone('12345')).toBeNull();
    expect(normalizePhone('+0500000000')).toBeNull();
  });

  it('strips separators before normalising', () => {
    expect(normalizePhone('053-332-5770')).toBe('+972533325770');
    expect(normalizePhone('+972 52 754 1119')).toBe('+972527541119');
  });
});
