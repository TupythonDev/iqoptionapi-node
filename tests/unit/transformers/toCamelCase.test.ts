import { toCamelCase } from '../../../src/transformers/toCamelCase';

describe('toCamelCase', () => {
  it('converts snake_case keys to camelCase', () => {
    expect(toCamelCase({ user_id: 1, first_name: 'A' })).toEqual({ userId: 1, firstName: 'A' });
  });

  it('converts nested objects recursively', () => {
    expect(toCamelCase({ outer_key: { inner_key: 42 } })).toEqual({ outerKey: { innerKey: 42 } });
  });

  it('converts arrays of objects', () => {
    expect(toCamelCase([{ user_id: 1 }, { user_id: 2 }])).toEqual([{ userId: 1 }, { userId: 2 }]);
  });

  it('leaves primitives unchanged', () => {
    expect(toCamelCase(42)).toBe(42);
    expect(toCamelCase('hello')).toBe('hello');
    expect(toCamelCase(null)).toBeNull();
    expect(toCamelCase(true)).toBe(true);
  });

  it('leaves already-camelCase keys unchanged', () => {
    expect(toCamelCase({ alreadyCamel: 'yes' })).toEqual({ alreadyCamel: 'yes' });
  });

  it('does not mutate the input object', () => {
    const input = { some_key: 1 };
    toCamelCase(input);
    expect(Object.keys(input)).toContain('some_key');
  });
});
