/**
 * Sequencer - Handles music patterns, loops, and timing
 */

import { Oscillator, LowPassFilter, Delay, parseNote, SAMPLE_RATE, sampleToInt16, Waveforms } from './synth.js';

/**
 * Default music configuration
 */
export const defaultConfig = {
  bpm: 120,
  timeSignature: [4, 4],
  swing: 0,
  tracks: [
    {
      name: 'lead',
      instrument: {
        waveform: 'sawtooth',
        gain: 0.3,
        envelope: { attack: 0.01, decay: 0.2, sustain: 0.5, release: 0.3 },
        filter: { cutoff: 2000 },
      },
      pattern: ['C4', 'E4', 'G4', 'E4', 'C4', 'G4', 'E4', 'G4'],
      noteLength: '8n',
      active: true,
    },
    {
      name: 'bass',
      instrument: {
        waveform: 'sine',
        gain: 0.5,
        envelope: { attack: 0.01, decay: 0.1, sustain: 0.8, release: 0.1 },
        filter: { cutoff: 500 },
      },
      pattern: ['C3', '-', 'C3', '-', 'G3', '-', 'G3', '-'],
      noteLength: '8n',
      active: true,
    },
    {
      name: 'percussion',
      instrument: {
        waveform: 'noise',
        gain: 0.15,
        envelope: { attack: 0.001, decay: 0.05, sustain: 0, release: 0.05 },
        filter: { cutoff: 8000 },
      },
      pattern: ['X', '-', 'X', '-', 'X', '-', 'X', '-'],
      noteLength: '8n',
      active: true,
    },
  ],
  effects: {
    delay: { time: 0.25, feedback: 0.3, mix: 0.2 },
    masterGain: 0.7,
  },
};

/**
 * Convert note length to duration in seconds
 * @param {string} noteLength - Note length string (e.g., '4n', '8n', '16n')
 * @param {number} bpm - Beats per minute
 * @returns {number} - Duration in seconds
 */
export function noteLengthToSeconds(noteLength, bpm) {
  const beatDuration = 60 / bpm; // Duration of one beat in seconds
  
  const lengths = {
    '1n': 4,     // whole note
    '2n': 2,     // half note
    '4n': 1,     // quarter note
    '8n': 0.5,   // eighth note
    '16n': 0.25, // sixteenth note
    '32n': 0.125, // thirty-second note
    '4t': 1/3,   // quarter triplet
    '8t': 0.5/3, // eighth triplet
  };
  
  return (lengths[noteLength] || 0.5) * beatDuration;
}

/**
 * Track instance for managing a single instrument track
 */
export class Track {
  constructor(config) {
    this.name = config.name || 'track';
    this.oscillator = new Oscillator(440, config.instrument?.waveform || Waveforms.SINE);
    this.oscillator.setGain(config.instrument?.gain || 0.3);
    this.filter = new LowPassFilter(config.instrument?.filter?.cutoff || 2000);
    this.envelope = config.instrument?.envelope || { attack: 0.01, decay: 0.1, sustain: 0.7, release: 0.2 };
    this.pattern = config.pattern || [];
    this.noteLength = config.noteLength || '8n';
    this.active = config.active !== false;
    
    this.currentStep = 0;
    this.noteStartTime = 0;
    this.noteDuration = 0;
    this.currentFrequency = 0;
  }

  /**
   * Update track configuration
   */
  updateConfig(config) {
    if (config.instrument?.waveform) {
      this.oscillator.setWaveform(config.instrument.waveform);
    }
    if (config.instrument?.gain !== undefined) {
      this.oscillator.setGain(config.instrument.gain);
    }
    if (config.instrument?.filter?.cutoff) {
      this.filter.setCutoff(config.instrument.filter.cutoff);
    }
    if (config.instrument?.envelope) {
      this.envelope = { ...this.envelope, ...config.instrument.envelope };
    }
    if (config.pattern) {
      this.pattern = config.pattern;
    }
    if (config.noteLength) {
      this.noteLength = config.noteLength;
    }
    if (config.active !== undefined) {
      this.active = config.active;
    }
  }

  /**
   * Start playing the next note in the pattern
   */
  triggerStep(bpm, currentTime) {
    if (this.pattern.length === 0) return;
    
    const noteStr = this.pattern[this.currentStep % this.pattern.length];
    this.currentFrequency = noteStr === 'X' ? 0 : parseNote(noteStr); // X = percussion hit
    this.oscillator.setFrequency(this.currentFrequency);
    this.noteStartTime = currentTime;
    this.noteDuration = noteLengthToSeconds(this.noteLength, bpm);
    
    // For percussion, trigger noise
    if (noteStr === 'X') {
      this.oscillator.setWaveform(Waveforms.NOISE);
      this.currentFrequency = 1; // Mark as active
    }
    
    this.currentStep = (this.currentStep + 1) % this.pattern.length;
  }

  /**
   * Generate a sample for current time
   */
  getSample(currentTime) {
    if (!this.active || this.currentFrequency === 0) return 0;
    
    const noteTime = currentTime - this.noteStartTime;
    if (noteTime < 0 || noteTime > this.noteDuration) return 0;
    
    // Apply envelope
    const envValue = this.applyEnvelope(noteTime);
    
    // Generate oscillator sample
    let sample = this.oscillator.nextSample() * envValue;
    
    // Apply filter
    sample = this.filter.process(sample);
    
    return sample;
  }

  /**
   * Apply ADSR envelope
   */
  applyEnvelope(noteTime) {
    const { attack, decay, sustain, release } = this.envelope;
    
    if (noteTime < attack) {
      return noteTime / attack;
    }
    
    if (noteTime < attack + decay) {
      const decayProgress = (noteTime - attack) / decay;
      return 1 - (1 - sustain) * decayProgress;
    }
    
    const releaseStart = this.noteDuration - release;
    if (noteTime >= releaseStart) {
      const releaseProgress = (noteTime - releaseStart) / release;
      return sustain * (1 - Math.min(1, releaseProgress));
    }
    
    return sustain;
  }

  /**
   * Reset track state
   */
  reset() {
    this.currentStep = 0;
    this.noteStartTime = 0;
    this.currentFrequency = 0;
    this.oscillator.phase = 0;
  }
}

/**
 * Main Sequencer class
 */
export class Sequencer {
  constructor(config = defaultConfig) {
    this.config = { ...defaultConfig, ...config };
    this.bpm = this.config.bpm;
    this.tracks = [];
    this.delay = new Delay(
      this.config.effects?.delay?.time || 0.25,
      this.config.effects?.delay?.feedback || 0.3,
      this.config.effects?.delay?.mix || 0.2
    );
    this.masterGain = this.config.effects?.masterGain || 0.7;
    
    this.isPlaying = false;
    this.currentTime = 0;
    this.lastStepTime = 0;
    this.stepDuration = 0;
    
    // Initialize tracks
    this.initializeTracks();
  }

  /**
   * Initialize tracks from configuration
   */
  initializeTracks() {
    this.tracks = [];
    for (const trackConfig of this.config.tracks || []) {
      this.tracks.push(new Track(trackConfig));
    }
    this.updateStepDuration();
  }

  /**
   * Update step duration based on BPM
   */
  updateStepDuration() {
    // Default to 8th notes for step timing
    this.stepDuration = noteLengthToSeconds('8n', this.bpm);
  }

  /**
   * Update configuration (for live editing)
   */
  updateConfig(newConfig) {
    // Update BPM
    if (newConfig.bpm !== undefined) {
      this.bpm = newConfig.bpm;
      this.updateStepDuration();
    }

    // Update effects
    if (newConfig.effects) {
      if (newConfig.effects.delay) {
        if (newConfig.effects.delay.time !== undefined) {
          this.delay.setDelayTime(newConfig.effects.delay.time);
        }
        if (newConfig.effects.delay.feedback !== undefined) {
          this.delay.setFeedback(newConfig.effects.delay.feedback);
        }
        if (newConfig.effects.delay.mix !== undefined) {
          this.delay.setMix(newConfig.effects.delay.mix);
        }
      }
      if (newConfig.effects.masterGain !== undefined) {
        this.masterGain = newConfig.effects.masterGain;
      }
    }

    // Update tracks
    if (newConfig.tracks) {
      for (let i = 0; i < newConfig.tracks.length; i++) {
        const trackConfig = newConfig.tracks[i];
        
        if (i < this.tracks.length) {
          // Update existing track
          this.tracks[i].updateConfig(trackConfig);
        } else {
          // Add new track
          this.tracks.push(new Track(trackConfig));
        }
      }
      
      // Remove extra tracks if config has fewer
      if (newConfig.tracks.length < this.tracks.length) {
        this.tracks = this.tracks.slice(0, newConfig.tracks.length);
      }
    }

    this.config = { ...this.config, ...newConfig };
  }

  /**
   * Start playback
   */
  start() {
    this.isPlaying = true;
    this.currentTime = 0;
    this.lastStepTime = 0;
    
    // Trigger first step for all tracks
    for (const track of this.tracks) {
      track.triggerStep(this.bpm, this.currentTime);
    }
  }

  /**
   * Stop playback
   */
  stop() {
    this.isPlaying = false;
    for (const track of this.tracks) {
      track.reset();
    }
  }

  /**
   * Generate a buffer of samples
   * @param {number} numSamples - Number of samples to generate
   * @returns {Buffer} - PCM audio buffer
   */
  generateSamples(numSamples) {
    const buffer = Buffer.alloc(numSamples * 2); // 16-bit samples
    
    for (let i = 0; i < numSamples; i++) {
      let sample = 0;
      
      if (this.isPlaying) {
        // Check if we need to trigger next step
        if (this.currentTime - this.lastStepTime >= this.stepDuration) {
          this.lastStepTime = this.currentTime;
          for (const track of this.tracks) {
            track.triggerStep(this.bpm, this.currentTime);
          }
        }
        
        // Mix all tracks
        for (const track of this.tracks) {
          sample += track.getSample(this.currentTime);
        }
        
        // Apply delay effect
        sample = this.delay.process(sample);
        
        // Apply master gain
        sample *= this.masterGain;
        
        // Advance time
        this.currentTime += 1 / SAMPLE_RATE;
      }
      
      // Convert to 16-bit PCM and write to buffer
      const int16Sample = sampleToInt16(sample);
      buffer.writeInt16LE(int16Sample, i * 2);
    }
    
    return buffer;
  }

  /**
   * Get current playback position
   */
  getPosition() {
    return {
      time: this.currentTime,
      step: this.tracks.length > 0 ? this.tracks[0].currentStep : 0,
      bar: Math.floor(this.currentTime / (4 * 60 / this.bpm)),
    };
  }

  /**
   * Get current configuration
   */
  getConfig() {
    return this.config;
  }
}
