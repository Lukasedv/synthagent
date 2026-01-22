/**
 * Tests for the synth module
 */

import { describe, it } from 'node:test';
import assert from 'node:assert';

import {
  generateSample,
  applyEnvelope,
  Oscillator,
  LowPassFilter,
  Delay,
  parseNote,
  sampleToInt16,
  Waveforms,
  Notes,
  SAMPLE_RATE,
} from './synth.js';

describe('Waveform Generation', () => {
  it('should generate sine wave samples', () => {
    // At phase 0, sine should be 0
    const sample0 = generateSample(Waveforms.SINE, 0);
    assert.strictEqual(Math.abs(sample0) < 0.001, true);
    
    // At phase 0.25, sine should be 1
    const sample25 = generateSample(Waveforms.SINE, 0.25);
    assert.strictEqual(Math.abs(sample25 - 1) < 0.001, true);
    
    // At phase 0.5, sine should be 0
    const sample50 = generateSample(Waveforms.SINE, 0.5);
    assert.strictEqual(Math.abs(sample50) < 0.001, true);
  });

  it('should generate square wave samples', () => {
    // First half of cycle should be 1
    const sample0 = generateSample(Waveforms.SQUARE, 0.25);
    assert.strictEqual(sample0, 1);
    
    // Second half should be -1
    const sample75 = generateSample(Waveforms.SQUARE, 0.75);
    assert.strictEqual(sample75, -1);
  });

  it('should generate noise samples', () => {
    // Noise should be random between -1 and 1
    const samples = Array.from({ length: 100 }, () => 
      generateSample(Waveforms.NOISE, Math.random())
    );
    
    for (const sample of samples) {
      assert.strictEqual(sample >= -1, true);
      assert.strictEqual(sample <= 1, true);
    }
    
    // Should have variance (not all same)
    const unique = new Set(samples);
    assert.strictEqual(unique.size > 1, true);
  });
});

describe('Note Parsing', () => {
  it('should parse standard notes', () => {
    assert.strictEqual(parseNote('C4'), Notes.C4);
    assert.strictEqual(parseNote('A4'), Notes.A4);
    assert.strictEqual(parseNote('G3'), Notes.G3);
  });

  it('should return 0 for rests', () => {
    assert.strictEqual(parseNote('REST'), 0);
    assert.strictEqual(parseNote('-'), 0);
    assert.strictEqual(parseNote(''), 0);
  });

  it('should parse notes with sharps and flats', () => {
    // C#4 should be slightly higher than C4
    const cSharp4 = parseNote('C#4');
    assert.strictEqual(cSharp4 > Notes.C4, true);
    assert.strictEqual(cSharp4 < Notes.D4, true);
    
    // Db4 should be same as C#4
    const dFlat4 = parseNote('Db4');
    assert.strictEqual(Math.abs(cSharp4 - dFlat4) < 1, true);
  });
});

describe('Oscillator', () => {
  it('should create oscillator with default values', () => {
    const osc = new Oscillator();
    assert.strictEqual(osc.frequency, 440);
    assert.strictEqual(osc.waveform, Waveforms.SINE);
    assert.strictEqual(osc.gain, 0.5);
  });

  it('should create oscillator with custom values', () => {
    const osc = new Oscillator(880, Waveforms.SQUARE);
    assert.strictEqual(osc.frequency, 880);
    assert.strictEqual(osc.waveform, Waveforms.SQUARE);
  });

  it('should generate samples', () => {
    const osc = new Oscillator(440, Waveforms.SINE);
    const samples = Array.from({ length: 100 }, () => osc.nextSample());
    
    // Samples should be within -1 to 1 (multiplied by gain)
    for (const sample of samples) {
      assert.strictEqual(Math.abs(sample) <= 0.5, true);
    }
  });

  it('should return 0 for frequency 0', () => {
    const osc = new Oscillator(0, Waveforms.SINE);
    const sample = osc.nextSample();
    assert.strictEqual(sample, 0);
  });
});

describe('LowPassFilter', () => {
  it('should attenuate high frequencies', () => {
    const filter = new LowPassFilter(100);
    
    // Feed high frequency signal (alternating 1, -1)
    let sum = 0;
    for (let i = 0; i < 100; i++) {
      const input = i % 2 === 0 ? 1 : -1;
      sum += Math.abs(filter.process(input));
    }
    
    // Average should be much less than 1 due to filtering
    const avg = sum / 100;
    assert.strictEqual(avg < 0.5, true);
  });
});

describe('Delay', () => {
  it('should create delay with default values', () => {
    const delay = new Delay();
    assert.strictEqual(delay.delayTime, 0.3);
    assert.strictEqual(delay.feedback, 0.4);
    assert.strictEqual(delay.mix, 0.3);
  });

  it('should pass through dry signal', () => {
    const delay = new Delay(0.1, 0, 0); // No feedback, no wet
    const output = delay.process(0.5);
    assert.strictEqual(output, 0.5);
  });
});

describe('Sample Conversion', () => {
  it('should convert sample to 16-bit integer', () => {
    // 0 should map to 0
    assert.strictEqual(sampleToInt16(0), 0);
    
    // 1 should map to 32767
    assert.strictEqual(sampleToInt16(1), 32767);
    
    // -1 should map to -32767
    assert.strictEqual(sampleToInt16(-1), -32767);
  });

  it('should clamp values outside range', () => {
    // Values > 1 should clamp to 32767
    assert.strictEqual(sampleToInt16(1.5), 32767);
    
    // Values < -1 should clamp to -32767
    assert.strictEqual(sampleToInt16(-1.5), -32767);
  });
});

describe('ADSR Envelope', () => {
  it('should ramp up during attack phase', () => {
    const envelope = { attack: 0.1, decay: 0.1, sustain: 0.7, release: 0.1 };
    
    const start = applyEnvelope(envelope, 0, 1);
    const midAttack = applyEnvelope(envelope, 0.05, 1);
    const endAttack = applyEnvelope(envelope, 0.099, 1);
    
    assert.strictEqual(start < midAttack, true);
    assert.strictEqual(midAttack < endAttack, true);
  });

  it('should reach sustain level after decay', () => {
    const envelope = { attack: 0.1, decay: 0.1, sustain: 0.7, release: 0.1 };
    
    const sustainLevel = applyEnvelope(envelope, 0.5, 1);
    assert.strictEqual(Math.abs(sustainLevel - 0.7) < 0.01, true);
  });

  it('should return 0 before note starts', () => {
    const envelope = { attack: 0.1, decay: 0.1, sustain: 0.7, release: 0.1 };
    const level = applyEnvelope(envelope, -0.1, 1);
    assert.strictEqual(level, 0);
  });
});
