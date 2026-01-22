/**
 * ConfigParser - Parses and watches the music configuration file
 * Supports a simple text-based format for defining music loops
 */

import fs from 'fs';
import path from 'path';

/**
 * Parse a music configuration file
 * @param {string} content - File content
 * @returns {Object} - Parsed configuration
 */
export function parseConfig(content) {
  const lines = content.split('\n');
  const config = {
    bpm: 120,
    timeSignature: [4, 4],
    tracks: [],
    effects: {
      delay: { time: 0.25, feedback: 0.3, mix: 0.2 },
      masterGain: 0.7,
    },
  };

  let currentTrack = null;

  for (let line of lines) {
    line = line.trim();
    
    // Skip comments and empty lines
    if (line.startsWith('#') || line.startsWith('//') || line === '') {
      continue;
    }

    // Parse key-value pairs
    const colonIndex = line.indexOf(':');
    if (colonIndex === -1) continue;
    
    const key = line.substring(0, colonIndex).trim().toLowerCase();
    const value = line.substring(colonIndex + 1).trim();

    // Global settings
    if (key === 'bpm' || key === 'tempo') {
      config.bpm = parseInt(value) || 120;
      continue;
    }

    if (key === 'time' || key === 'timesignature') {
      const parts = value.split('/').map(p => parseInt(p.trim()));
      if (parts.length === 2) {
        config.timeSignature = parts;
      }
      continue;
    }

    if (key === 'mastergain' || key === 'master' || key === 'volume') {
      config.effects.masterGain = parseFloat(value) || 0.7;
      continue;
    }

    // Delay effect settings
    if (key === 'delay.time' || key === 'delaytime') {
      config.effects.delay.time = parseFloat(value) || 0.25;
      continue;
    }

    if (key === 'delay.feedback' || key === 'delayfeedback') {
      config.effects.delay.feedback = parseFloat(value) || 0.3;
      continue;
    }

    if (key === 'delay.mix' || key === 'delaymix') {
      config.effects.delay.mix = parseFloat(value) || 0.2;
      continue;
    }

    // Track definition
    if (key === 'track' || key === 'instrument') {
      currentTrack = {
        name: value || `track${config.tracks.length + 1}`,
        instrument: {
          waveform: 'sine',
          gain: 0.3,
          envelope: { attack: 0.01, decay: 0.1, sustain: 0.7, release: 0.2 },
          filter: { cutoff: 2000 },
        },
        pattern: [],
        noteLength: '8n',
        active: true,
      };
      config.tracks.push(currentTrack);
      continue;
    }

    // Track-specific settings (only if we have a current track)
    if (currentTrack) {
      if (key === 'waveform' || key === 'wave' || key === 'type') {
        currentTrack.instrument.waveform = value.toLowerCase();
        continue;
      }

      if (key === 'gain' || key === 'level') {
        currentTrack.instrument.gain = parseFloat(value) || 0.3;
        continue;
      }

      if (key === 'filter' || key === 'cutoff') {
        currentTrack.instrument.filter.cutoff = parseInt(value) || 2000;
        continue;
      }

      if (key === 'attack') {
        currentTrack.instrument.envelope.attack = parseFloat(value) || 0.01;
        continue;
      }

      if (key === 'decay') {
        currentTrack.instrument.envelope.decay = parseFloat(value) || 0.1;
        continue;
      }

      if (key === 'sustain') {
        currentTrack.instrument.envelope.sustain = parseFloat(value) || 0.7;
        continue;
      }

      if (key === 'release') {
        currentTrack.instrument.envelope.release = parseFloat(value) || 0.2;
        continue;
      }

      if (key === 'pattern' || key === 'notes' || key === 'sequence') {
        // Parse pattern: C4 E4 G4 E4 or C4,E4,G4,E4 or [C4, E4, G4, E4]
        let patternStr = value.replace(/[\[\]]/g, '');
        const separator = patternStr.includes(',') ? ',' : ' ';
        currentTrack.pattern = patternStr.split(separator)
          .map(n => n.trim())
          .filter(n => n.length > 0);
        continue;
      }

      if (key === 'notelength' || key === 'length' || key === 'duration') {
        currentTrack.noteLength = value;
        continue;
      }

      if (key === 'active' || key === 'enabled' || key === 'mute') {
        const isActive = key === 'mute' 
          ? !['true', '1', 'yes'].includes(value.toLowerCase())
          : ['true', '1', 'yes'].includes(value.toLowerCase());
        currentTrack.active = isActive;
        continue;
      }
    }
  }

  // Add default track if none defined
  if (config.tracks.length === 0) {
    config.tracks.push({
      name: 'default',
      instrument: {
        waveform: 'sine',
        gain: 0.3,
        envelope: { attack: 0.01, decay: 0.1, sustain: 0.7, release: 0.2 },
        filter: { cutoff: 2000 },
      },
      pattern: ['C4', 'E4', 'G4', 'E4'],
      noteLength: '8n',
      active: true,
    });
  }

  return config;
}

/**
 * Load configuration from file
 * @param {string} filePath - Path to configuration file
 * @returns {Object} - Parsed configuration
 */
export function loadConfigFile(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    return parseConfig(content);
  } catch (err) {
    console.error(`Error loading config file: ${err.message}`);
    return null;
  }
}

/**
 * Save configuration to file
 * @param {string} filePath - Path to configuration file
 * @param {Object} config - Configuration object
 */
export function saveConfigFile(filePath, config) {
  const lines = [];
  
  lines.push('# SynthAgent Music Configuration');
  lines.push('# Edit this file to change the music in real-time!');
  lines.push('');
  
  // Global settings
  lines.push(`BPM: ${config.bpm}`);
  lines.push(`Time: ${config.timeSignature[0]}/${config.timeSignature[1]}`);
  lines.push(`MasterGain: ${config.effects?.masterGain || 0.7}`);
  lines.push('');
  
  // Delay settings
  lines.push('# Delay Effect');
  lines.push(`Delay.Time: ${config.effects?.delay?.time || 0.25}`);
  lines.push(`Delay.Feedback: ${config.effects?.delay?.feedback || 0.3}`);
  lines.push(`Delay.Mix: ${config.effects?.delay?.mix || 0.2}`);
  lines.push('');
  
  // Tracks
  for (const track of config.tracks || []) {
    lines.push('# ---- Track ----');
    lines.push(`Track: ${track.name}`);
    lines.push(`Waveform: ${track.instrument?.waveform || 'sine'}`);
    lines.push(`Gain: ${track.instrument?.gain || 0.3}`);
    lines.push(`Filter: ${track.instrument?.filter?.cutoff || 2000}`);
    lines.push(`Attack: ${track.instrument?.envelope?.attack || 0.01}`);
    lines.push(`Decay: ${track.instrument?.envelope?.decay || 0.1}`);
    lines.push(`Sustain: ${track.instrument?.envelope?.sustain || 0.7}`);
    lines.push(`Release: ${track.instrument?.envelope?.release || 0.2}`);
    lines.push(`Pattern: ${track.pattern?.join(' ') || 'C4'}`);
    lines.push(`NoteLength: ${track.noteLength || '8n'}`);
    lines.push(`Active: ${track.active !== false}`);
    lines.push('');
  }
  
  fs.writeFileSync(filePath, lines.join('\n'));
}

/**
 * Create a default configuration file
 * @param {string} filePath - Path to create the file
 */
export function createDefaultConfigFile(filePath) {
  const defaultContent = `# SynthAgent Music Configuration
# Edit this file to change the music in real-time!
# Save the file and the music will update automatically.

# ===================
# GLOBAL SETTINGS
# ===================
BPM: 120
Time: 4/4
MasterGain: 0.7

# ===================
# DELAY EFFECT
# ===================
Delay.Time: 0.25
Delay.Feedback: 0.3
Delay.Mix: 0.2

# ===================
# TRACKS
# ===================
# Available waveforms: sine, square, sawtooth, triangle, noise
# Pattern notes: C3-C6, use - for rest, X for percussion hit
# Note lengths: 1n, 2n, 4n, 8n, 16n, 32n, 4t, 8t

# ---- Lead Melody ----
Track: lead
Waveform: sawtooth
Gain: 0.25
Filter: 2000
Attack: 0.01
Decay: 0.2
Sustain: 0.5
Release: 0.3
Pattern: C4 E4 G4 E4 C4 G4 E4 G4
NoteLength: 8n
Active: true

# ---- Bass Line ----
Track: bass
Waveform: sine
Gain: 0.4
Filter: 500
Attack: 0.01
Decay: 0.1
Sustain: 0.8
Release: 0.1
Pattern: C3 - C3 - G3 - G3 -
NoteLength: 8n
Active: true

# ---- Hi-Hat ----
Track: hihat
Waveform: noise
Gain: 0.12
Filter: 8000
Attack: 0.001
Decay: 0.05
Sustain: 0
Release: 0.05
Pattern: X - X - X - X -
NoteLength: 8n
Active: true
`;

  fs.writeFileSync(filePath, defaultContent);
  return filePath;
}

/**
 * FileWatcher - Watches for file changes and triggers callbacks
 */
export class FileWatcher {
  constructor(filePath, onChange) {
    this.filePath = filePath;
    this.onChange = onChange;
    this.watcher = null;
    this.debounceTimer = null;
    this.lastContent = null;
  }

  /**
   * Start watching the file
   */
  start() {
    try {
      // Read initial content
      this.lastContent = fs.readFileSync(this.filePath, 'utf-8');
      
      // Watch for changes
      this.watcher = fs.watch(this.filePath, (eventType, filename) => {
        if (eventType === 'change') {
          // Debounce to avoid multiple rapid triggers
          clearTimeout(this.debounceTimer);
          this.debounceTimer = setTimeout(() => {
            this.checkForChanges();
          }, 100);
        }
      });
      
      return true;
    } catch (err) {
      console.error(`Error starting file watcher: ${err.message}`);
      return false;
    }
  }

  /**
   * Check if file content has changed
   */
  checkForChanges() {
    try {
      const content = fs.readFileSync(this.filePath, 'utf-8');
      if (content !== this.lastContent) {
        this.lastContent = content;
        const config = parseConfig(content);
        if (this.onChange) {
          this.onChange(config);
        }
      }
    } catch (err) {
      // Expected errors during file save operations:
      // - ENOENT: File temporarily removed during atomic save
      // - EACCES: Temporary permission issue during write
      // - EBUSY: File locked by another process
      // These are transient and the next change event will trigger a successful read
      if (err.code && !['ENOENT', 'EACCES', 'EBUSY'].includes(err.code)) {
        console.error(`Unexpected file watch error: ${err.code} - ${err.message}`);
      }
    }
  }

  /**
   * Stop watching
   */
  stop() {
    if (this.watcher) {
      this.watcher.close();
      this.watcher = null;
    }
    clearTimeout(this.debounceTimer);
  }
}
