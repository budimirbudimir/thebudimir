import { describe, expect, test } from 'bun:test';

describe('App', () => {
  test('placeholder test passes', () => {
    expect(true).toBe(true);
  });

  test('basic arithmetic works', () => {
    expect(1 + 1).toBe(2);
  });
});
