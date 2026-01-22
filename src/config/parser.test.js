/**
 * Tests for the config parser module
 */

import { describe, it } from 'node:test';
import assert from 'node:assert';

import { parseConfig } from './parser.js';

describe('Config Parser', () => {
  it('should parse BPM', () => {
    const content = 'BPM: 140';
    const config = parseConfig(content);
    assert.strictEqual(config.bpm, 140);
  });

  it('should parse tempo as alias for BPM', () => {
    const content = 'Tempo: 130';
    const config = parseConfig(content);
    assert.strictEqual(config.bpm, 130);
  });

  it('should parse master gain', () => {
    const content = 'MasterGain: 0.5';
    const config = parseConfig(content);
    assert.strictEqual(config.effects.masterGain, 0.5);
  });

  it('should parse delay settings', () => {
    const content = `
Delay.Time: 0.4
Delay.Feedback: 0.5
Delay.Mix: 0.3
`;
    const config = parseConfig(content);
    assert.strictEqual(config.effects.delay.time, 0.4);
    assert.strictEqual(config.effects.delay.feedback, 0.5);
    assert.strictEqual(config.effects.delay.mix, 0.3);
  });

  it('should skip comments', () => {
    const content = `
# This is a comment
BPM: 120
// Another comment
MasterGain: 0.7
`;
    const config = parseConfig(content);
    assert.strictEqual(config.bpm, 120);
    assert.strictEqual(config.effects.masterGain, 0.7);
  });

  it('should parse a track', () => {
    const content = `
Track: lead
Waveform: sawtooth
Gain: 0.3
Filter: 2000
Pattern: C4 E4 G4
NoteLength: 8n
Active: true
`;
    const config = parseConfig(content);
    assert.strictEqual(config.tracks.length, 1);
    assert.strictEqual(config.tracks[0].name, 'lead');
    assert.strictEqual(config.tracks[0].instrument.waveform, 'sawtooth');
    assert.strictEqual(config.tracks[0].instrument.gain, 0.3);
    assert.strictEqual(config.tracks[0].instrument.filter.cutoff, 2000);
    assert.deepStrictEqual(config.tracks[0].pattern, ['C4', 'E4', 'G4']);
    assert.strictEqual(config.tracks[0].noteLength, '8n');
    assert.strictEqual(config.tracks[0].active, true);
  });

  it('should parse multiple tracks', () => {
    const content = `
Track: lead
Waveform: sine
Pattern: C4 E4

Track: bass
Waveform: square
Pattern: C3 G3
`;
    const config = parseConfig(content);
    assert.strictEqual(config.tracks.length, 2);
    assert.strictEqual(config.tracks[0].name, 'lead');
    assert.strictEqual(config.tracks[1].name, 'bass');
  });

  it('should parse envelope settings', () => {
    const content = `
Track: test
Attack: 0.05
Decay: 0.2
Sustain: 0.6
Release: 0.4
`;
    const config = parseConfig(content);
    assert.strictEqual(config.tracks[0].instrument.envelope.attack, 0.05);
    assert.strictEqual(config.tracks[0].instrument.envelope.decay, 0.2);
    assert.strictEqual(config.tracks[0].instrument.envelope.sustain, 0.6);
    assert.strictEqual(config.tracks[0].instrument.envelope.release, 0.4);
  });

  it('should handle muted tracks', () => {
    const content = `
Track: muted
Active: false
`;
    const config = parseConfig(content);
    assert.strictEqual(config.tracks[0].active, false);
  });

  it('should handle mute keyword', () => {
    const content = `
Track: muted
Mute: true
`;
    const config = parseConfig(content);
    assert.strictEqual(config.tracks[0].active, false);
  });

  it('should parse comma-separated patterns', () => {
    const content = `
Track: test
Pattern: C4,E4,G4,B4
`;
    const config = parseConfig(content);
    assert.deepStrictEqual(config.tracks[0].pattern, ['C4', 'E4', 'G4', 'B4']);
  });

  it('should create default track if none defined', () => {
    const content = 'BPM: 120';
    const config = parseConfig(content);
    assert.strictEqual(config.tracks.length, 1);
    assert.strictEqual(config.tracks[0].name, 'default');
  });

  it('should handle case-insensitive keys', () => {
    const content = `
bpm: 150
MASTERGAIN: 0.6
track: TestTrack
waveform: SINE
`;
    const config = parseConfig(content);
    assert.strictEqual(config.bpm, 150);
    assert.strictEqual(config.effects.masterGain, 0.6);
    assert.strictEqual(config.tracks[0].name, 'TestTrack');
    assert.strictEqual(config.tracks[0].instrument.waveform, 'sine');
  });
});
