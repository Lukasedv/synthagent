/**
 * Synth - Core synthesizer module for generating audio samples
 * Produces PCM audio data that can be piped to audio output
 */

// Audio constants
export const SAMPLE_RATE = 44100;
export const BIT_DEPTH = 16;
export const CHANNELS = 1;

/**
 * Available waveforms for oscillators
 */
export const Waveforms = {
  SINE: 'sine',
  SQUARE: 'square',
  SAWTOOTH: 'sawtooth',
  TRIANGLE: 'triangle',
  NOISE: 'noise',
};

/**
 * Musical note frequencies (A4 = 440Hz standard)
 */
export const Notes = {
  C3: 130.81, D3: 146.83, E3: 164.81, F3: 174.61, G3: 196.00, A3: 220.00, B3: 246.94,
  C4: 261.63, D4: 293.66, E4: 329.63, F4: 349.23, G4: 392.00, A4: 440.00, B4: 493.88,
  C5: 523.25, D5: 587.33, E5: 659.25, F5: 698.46, G5: 783.99, A5: 880.00, B5: 987.77,
  C6: 1046.50,
  REST: 0, // silence
};

/**
 * Generate a single sample for a given waveform
 * @param {string} waveform - Type of waveform
 * @param {number} phase - Current phase (0-1)
 * @returns {number} - Sample value between -1 and 1
 */
export function generateSample(waveform, phase) {
  switch (waveform) {
    case Waveforms.SINE:
      return Math.sin(2 * Math.PI * phase);
    case Waveforms.SQUARE:
      return phase < 0.5 ? 1 : -1;
    case Waveforms.SAWTOOTH:
      return 2 * (phase - Math.floor(phase + 0.5));
    case Waveforms.TRIANGLE:
      return 4 * Math.abs(phase - 0.5) - 1;
    case Waveforms.NOISE:
      return Math.random() * 2 - 1;
    default:
      return Math.sin(2 * Math.PI * phase);
  }
}

/**
 * Apply an ADSR envelope to amplitude
 * @param {Object} envelope - ADSR parameters
 * @param {number} noteTime - Time since note start (seconds)
 * @param {number} noteDuration - Total note duration (seconds)
 * @returns {number} - Envelope multiplier (0-1)
 */
export function applyEnvelope(envelope, noteTime, noteDuration) {
  const { attack = 0.01, decay = 0.1, sustain = 0.7, release = 0.2 } = envelope;
  
  if (noteTime < 0) return 0;
  
  // Attack phase
  if (noteTime < attack) {
    return noteTime / attack;
  }
  
  // Decay phase
  const decayStart = attack;
  if (noteTime < decayStart + decay) {
    const decayProgress = (noteTime - decayStart) / decay;
    return 1 - (1 - sustain) * decayProgress;
  }
  
  // Sustain phase
  const releaseStart = noteDuration - release;
  if (noteTime < releaseStart) {
    return sustain;
  }
  
  // Release phase
  if (noteTime < noteDuration) {
    const releaseProgress = (noteTime - releaseStart) / release;
    return sustain * (1 - releaseProgress);
  }
  
  return 0;
}

/**
 * Oscillator class for generating continuous waveforms
 */
export class Oscillator {
  constructor(frequency = 440, waveform = Waveforms.SINE) {
    this.frequency = frequency;
    this.waveform = waveform;
    this.phase = 0;
    this.gain = 0.5;
    this.envelope = { attack: 0.01, decay: 0.1, sustain: 0.7, release: 0.2 };
  }

  /**
   * Generate next sample
   * @returns {number} - Sample value
   */
  nextSample() {
    if (this.frequency === 0) return 0;
    
    const sample = generateSample(this.waveform, this.phase) * this.gain;
    this.phase += this.frequency / SAMPLE_RATE;
    if (this.phase >= 1) this.phase -= 1;
    return sample;
  }

  setFrequency(freq) {
    this.frequency = freq;
  }

  setWaveform(waveform) {
    this.waveform = waveform;
  }

  setGain(gain) {
    this.gain = Math.max(0, Math.min(1, gain));
  }
}

/**
 * Simple lowpass filter
 */
export class LowPassFilter {
  constructor(cutoff = 1000) {
    this.cutoff = cutoff;
    this.lastOutput = 0;
  }

  process(input) {
    const rc = 1 / (2 * Math.PI * this.cutoff);
    const dt = 1 / SAMPLE_RATE;
    const alpha = dt / (rc + dt);
    this.lastOutput = this.lastOutput + alpha * (input - this.lastOutput);
    return this.lastOutput;
  }

  setCutoff(cutoff) {
    this.cutoff = Math.max(20, Math.min(20000, cutoff));
  }
}

/**
 * Delay effect
 */
export class Delay {
  constructor(delayTime = 0.3, feedback = 0.4, mix = 0.3) {
    this.delayTime = delayTime;
    this.feedback = feedback;
    this.mix = mix;
    this.bufferSize = Math.floor(delayTime * SAMPLE_RATE);
    this.buffer = new Float32Array(this.bufferSize);
    this.writeIndex = 0;
  }

  process(input) {
    const readIndex = (this.writeIndex - this.bufferSize + this.buffer.length) % this.buffer.length;
    const delayed = this.buffer[readIndex] || 0;
    const output = input + delayed * this.feedback;
    this.buffer[this.writeIndex] = output;
    this.writeIndex = (this.writeIndex + 1) % this.buffer.length;
    return input * (1 - this.mix) + delayed * this.mix;
  }

  setDelayTime(time) {
    this.delayTime = time;
    const newBufferSize = Math.floor(time * SAMPLE_RATE);
    if (newBufferSize !== this.bufferSize) {
      this.bufferSize = newBufferSize;
      this.buffer = new Float32Array(this.bufferSize);
      this.writeIndex = 0;
    }
  }

  setFeedback(feedback) {
    this.feedback = Math.max(0, Math.min(0.95, feedback));
  }

  setMix(mix) {
    this.mix = Math.max(0, Math.min(1, mix));
  }
}

/**
 * Parse note string to frequency
 * @param {string} noteStr - Note string like "C4", "A#4", "Bb3"
 * @returns {number} - Frequency in Hz
 */
export function parseNote(noteStr) {
  if (!noteStr || noteStr === 'REST' || noteStr === '-') return 0;
  
  // Direct note lookup
  if (Notes[noteStr.toUpperCase()]) {
    return Notes[noteStr.toUpperCase()];
  }
  
  // Parse note with accidentals
  const match = noteStr.match(/^([A-Ga-g])([#b]?)(\d)$/);
  if (!match) return 440; // Default to A4
  
  const [, note, accidental, octave] = match;
  const noteIndex = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 }[note.toUpperCase()];
  let semitone = noteIndex + (parseInt(octave) - 4) * 12;
  
  if (accidental === '#') semitone += 1;
  if (accidental === 'b') semitone -= 1;
  
  // A4 = 440Hz, calculate frequency based on semitone distance from A4
  return 440 * Math.pow(2, (semitone - 9) / 12);
}

/**
 * Convert sample value to 16-bit PCM buffer
 * @param {number} sample - Sample value (-1 to 1)
 * @returns {number} - 16-bit integer value
 */
export function sampleToInt16(sample) {
  // Clamp sample to -1 to 1 range
  const clamped = Math.max(-1, Math.min(1, sample));
  // Convert to 16-bit integer
  return Math.floor(clamped * 32767);
}
