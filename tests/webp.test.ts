import { describe, expect, test } from 'bun:test';

const isWebP = (bytes: Uint8Array): boolean => {
  if (bytes.length < 12) return false;
  const riff = String.fromCharCode(...bytes.slice(0, 4));
  const webp = String.fromCharCode(...bytes.slice(8, 12));
  return riff === 'RIFF' && webp === 'WEBP';
};

describe('webp magic bytes', () => {
  test('accepts RIFF....WEBP header', () => {
    const bytes = new Uint8Array(12);
    bytes.set([0x52, 0x49, 0x46, 0x46], 0);
    bytes.set([0x00, 0x00, 0x00, 0x00], 4);
    bytes.set([0x57, 0x45, 0x42, 0x50], 8);
    expect(isWebP(bytes)).toBe(true);
  });

  test('rejects non-webp', () => {
    expect(isWebP(new Uint8Array([0xff, 0xd8, 0xff]))).toBe(false);
  });
});
