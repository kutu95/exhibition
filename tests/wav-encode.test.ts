import { describe, expect, it } from "vitest";

import { encodeMonoWav, mixToMono } from "../lib/wav-encode";

describe("wav encode", () => {
  it("mixes stereo down to mono", () => {
    const left = new Float32Array([1, 0]);
    const right = new Float32Array([-1, 0.5]);
    expect(Array.from(mixToMono([left, right]))).toEqual([0, 0.25]);
  });

  it("writes a valid 16-bit mono WAV header", () => {
    const samples = new Float32Array([0, 1, -1]);
    const wav = encodeMonoWav(samples, 44100);
    const text = String.fromCharCode(...wav.slice(0, 12));
    expect(text.startsWith("RIFF")).toBe(true);
    expect(text.endsWith("WAVE")).toBe(true);
    expect(wav.byteLength).toBe(44 + samples.length * 2);
  });
});
