import { describe, expect, it } from 'vitest';
import { parseCsv, parseCsvObjects, toCsv } from '../csv';

describe('csv', () => {
  it('parses quoted fields, escaped quotes, CRLF and BOM', () => {
    const input = '﻿a,b,c\r\n"x, y","he said ""hi""",3\r\n\r\n';
    expect(parseCsv(input)).toEqual([
      ['a', 'b', 'c'],
      ['x, y', 'he said "hi"', '3'],
    ]);
  });

  it('handles newlines inside quotes and a missing trailing newline', () => {
    expect(parseCsv('a,b\n"line1\nline2",z')).toEqual([
      ['a', 'b'],
      ['line1\nline2', 'z'],
    ]);
  });

  it('maps rows to header keys and pads short rows', () => {
    const { headers, records } = parseCsvObjects(' Name ,Team\nAva\n');
    expect(headers).toEqual(['Name', 'Team']);
    expect(records).toEqual([{ Name: 'Ava', Team: '' }]);
  });

  it('round-trips through toCsv', () => {
    const csv = toCsv(['a', 'b'], [['1,2', 'q"q'], [null, 5]]);
    expect(parseCsv(csv)).toEqual([
      ['a', 'b'],
      ['1,2', 'q"q'],
      ['', '5'],
    ]);
  });
});
