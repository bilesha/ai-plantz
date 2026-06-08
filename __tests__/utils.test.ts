// __tests__/utils.test.ts

// ─── csvField ─────────────────────────────────────────────────────────────────
// Copied verbatim from app/screens/settings.tsx (not exported from source).
function csvField(val: string | number | null | undefined): string {
  if (val == null) return '';
  const s = String(val);
  return /[,"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

// ─── Daily plant hash ─────────────────────────────────────────────────────────
// Extracted from the useMemo in app/index.tsx.
function computeHash(dateString: string): number {
  return dateString.split('').reduce((acc, ch) => acc + ch.charCodeAt(0), 0);
}

function dailyPlantHash(dateString: string, arrayLength: number): number {
  return computeHash(dateString) % arrayLength;
}

// ─── csvField tests ───────────────────────────────────────────────────────────

describe('csvField', () => {
  test('null returns empty string', () => {
    expect(csvField(null)).toBe('');
  });

  test('undefined returns empty string', () => {
    expect(csvField(undefined)).toBe('');
  });

  test('number is returned as plain string without quotes', () => {
    expect(csvField(42)).toBe('42');
    expect(csvField(0)).toBe('0');
  });

  test('plain string with no special chars is returned as-is', () => {
    expect(csvField('Monstera')).toBe('Monstera');
  });

  test('string containing a comma is wrapped in double quotes', () => {
    expect(csvField('leaves yellow, wilting')).toBe('"leaves yellow, wilting"');
  });

  test('string containing a newline is wrapped in double quotes', () => {
    expect(csvField('line1\nline2')).toBe('"line1\nline2"');
  });

  test('string containing a double quote is escaped as "" and wrapped', () => {
    expect(csvField('say "hello"')).toBe('"say ""hello"""');
  });
});

// ─── Daily plant hash tests ───────────────────────────────────────────────────

describe('dailyPlantHash', () => {
  test('given a fixed dateString the result is deterministic', () => {
    expect(dailyPlantHash('Mon Jun 09 2026', 9)).toBe(dailyPlantHash('Mon Jun 09 2026', 9));
  });

  test('"Mon Jun 09 2026" with length 9 produces index 3 (hash 1002)', () => {
    // hash sum = 1002, 1002 % 9 = 3
    expect(dailyPlantHash('Mon Jun 09 2026', 9)).toBe(3);
  });

  test('index is always within bounds across several array lengths', () => {
    const dateString = 'Mon Jun 09 2026';
    for (const length of [1, 5, 9, 20, 100]) {
      const idx = dailyPlantHash(dateString, length);
      expect(idx).toBeGreaterThanOrEqual(0);
      expect(idx).toBeLessThan(length);
    }
  });

  test('different dateStrings produce different raw hash values', () => {
    expect(computeHash('Mon Jun 09 2026')).toBe(1002);
    expect(computeHash('Tue Jun 10 2026')).toBe(998);
    expect(computeHash('Wed Jun 11 2026')).toBe(985);
  });

  test('different dateStrings map to different indices with length 9', () => {
    const mon = dailyPlantHash('Mon Jun 09 2026', 9); // 3
    const tue = dailyPlantHash('Tue Jun 10 2026', 9); // 8
    const wed = dailyPlantHash('Wed Jun 11 2026', 9); // 4
    expect(mon).not.toBe(tue);
    expect(tue).not.toBe(wed);
    expect(mon).not.toBe(wed);
  });
});
