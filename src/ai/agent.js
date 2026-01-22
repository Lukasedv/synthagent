/**
 * AI Agent - GitHub Copilot SDK integration for AI-controlled music modification
 * 
 * This module provides AI-powered music manipulation using the GitHub Copilot SDK.
 * The AI can interpret natural language commands to modify the music configuration.
 */

import fs from 'fs';
import path from 'path';
import { parseConfig, saveConfigFile } from '../config/parser.js';

/**
 * MusicAgent - AI agent for interpreting and executing music commands
 */
export class MusicAgent {
  constructor(configPath, onConfigUpdate) {
    this.configPath = configPath;
    this.onConfigUpdate = onConfigUpdate;
    this.currentConfig = null;
    this.commandHistory = [];
    
    // Available music modification commands
    this.commands = {
      setBpm: this.setBpm.bind(this),
      setTempo: this.setBpm.bind(this), // alias
      setVolume: this.setMasterGain.bind(this),
      setMasterGain: this.setMasterGain.bind(this),
      setTrackGain: this.setTrackGain.bind(this),
      setWaveform: this.setWaveform.bind(this),
      setPattern: this.setPattern.bind(this),
      setFilter: this.setFilter.bind(this),
      muteTrack: this.muteTrack.bind(this),
      unmuteTrack: this.unmuteTrack.bind(this),
      setDelay: this.setDelay.bind(this),
      addTrack: this.addTrack.bind(this),
      removeTrack: this.removeTrack.bind(this),
    };

    // Load initial config
    this.loadConfig();
  }

  /**
   * Load current configuration
   */
  loadConfig() {
    try {
      const content = fs.readFileSync(this.configPath, 'utf-8');
      this.currentConfig = parseConfig(content);
    } catch (err) {
      console.error('Error loading config:', err.message);
    }
  }

  /**
   * Save and apply configuration
   */
  applyConfig() {
    if (this.currentConfig) {
      saveConfigFile(this.configPath, this.currentConfig);
      if (this.onConfigUpdate) {
        this.onConfigUpdate(this.currentConfig);
      }
    }
  }

  /**
   * Parse and execute a natural language command
   * @param {string} command - Natural language command
   * @returns {Object} - Result of command execution
   */
  async executeCommand(command) {
    const lowerCommand = command.toLowerCase().trim();
    this.commandHistory.push({ command, timestamp: Date.now() });

    try {
      // Parse command intent
      const result = this.interpretCommand(lowerCommand);
      
      if (result.success) {
        this.applyConfig();
      }
      
      return result;
    } catch (err) {
      return { success: false, message: `Error: ${err.message}` };
    }
  }

  /**
   * Interpret natural language command
   * @param {string} command - Lowercase command string
   * @returns {Object} - Interpretation result
   */
  interpretCommand(command) {
    this.loadConfig(); // Reload latest config

    // Speed/Tempo commands (faster/slower without needing bpm keyword)
    if (command.includes('faster') || command.includes('speed up')) {
      return this.setBpm(this.currentConfig.bpm + 10);
    }
    if (command.includes('slower') || command.includes('slow down')) {
      return this.setBpm(this.currentConfig.bpm - 10);
    }

    // BPM/Tempo commands with explicit values
    if (command.includes('bpm') || command.includes('tempo')) {
      const match = command.match(/(\d+)/);
      if (match) {
        const bpm = parseInt(match[1]);
        return this.setBpm(bpm);
      }
    }

    // Volume commands
    if (command.includes('volume') || command.includes('louder') || command.includes('quieter') || command.includes('gain')) {
      if (command.includes('louder') || command.includes('up')) {
        return this.setMasterGain(Math.min(1, (this.currentConfig.effects?.masterGain || 0.7) + 0.1));
      }
      if (command.includes('quieter') || command.includes('down') || command.includes('softer')) {
        return this.setMasterGain(Math.max(0.1, (this.currentConfig.effects?.masterGain || 0.7) - 0.1));
      }
      
      const match = command.match(/([\d.]+)/);
      if (match) {
        return this.setMasterGain(parseFloat(match[1]));
      }
    }

    // Waveform commands
    const waveforms = ['sine', 'square', 'sawtooth', 'triangle', 'noise'];
    for (const waveform of waveforms) {
      if (command.includes(waveform)) {
        // Find which track to apply to
        const trackName = this.extractTrackName(command);
        return this.setWaveform(trackName, waveform);
      }
    }

    // Mute/unmute commands
    if (command.includes('mute')) {
      const trackName = this.extractTrackName(command);
      if (command.includes('unmute') || command.includes('un-mute')) {
        return this.unmuteTrack(trackName);
      }
      return this.muteTrack(trackName);
    }

    // Pattern commands
    if (command.includes('pattern') || command.includes('notes') || command.includes('melody')) {
      const trackName = this.extractTrackName(command);
      const pattern = this.extractPattern(command);
      if (pattern.length > 0) {
        return this.setPattern(trackName, pattern);
      }
    }

    // Brighter/Darker commands (filter adjustments without needing filter keyword)
    if (command.includes('brighter') || command.includes('bright')) {
      const trackName = this.extractTrackName(command);
      return this.adjustFilter(trackName, 500);
    }
    if (command.includes('darker') || command.includes('dark') || command.includes('muffled')) {
      const trackName = this.extractTrackName(command);
      return this.adjustFilter(trackName, -500);
    }

    // Filter commands with explicit values
    if (command.includes('filter') || command.includes('cutoff')) {
      const match = command.match(/(\d+)/);
      if (match) {
        const trackName = this.extractTrackName(command);
        return this.setFilter(trackName, parseInt(match[1]));
      }
    }

    // Delay commands
    if (command.includes('delay') || command.includes('echo')) {
      if (command.includes('more')) {
        return this.adjustDelay(0.1, 0.1);
      }
      if (command.includes('less') || command.includes('remove') || command.includes('off')) {
        return this.adjustDelay(-0.1, -0.1);
      }
    }

    // Add track
    if (command.includes('add track') || command.includes('new track')) {
      const trackName = this.extractNewTrackName(command);
      return this.addTrack(trackName);
    }

    // Remove track
    if (command.includes('remove track') || command.includes('delete track')) {
      const trackName = this.extractTrackName(command);
      return this.removeTrack(trackName);
    }

    // Scale/key changes
    if (command.includes('major')) {
      return this.setScale('major');
    }
    if (command.includes('minor')) {
      return this.setScale('minor');
    }

    return { success: false, message: 'Command not recognized. Try commands like: "set bpm to 140", "make bass louder", "change lead to square wave"' };
  }

  /**
   * Extract track name from command
   */
  extractTrackName(command) {
    const trackNames = this.currentConfig.tracks.map(t => t.name.toLowerCase());
    for (const name of trackNames) {
      if (command.includes(name)) {
        return name;
      }
    }
    // Default to first track if available, otherwise return null
    // Commands that receive null should handle it appropriately
    const firstTrack = this.currentConfig.tracks[0];
    return firstTrack ? firstTrack.name : null;
  }

  /**
   * Extract new track name from command
   */
  extractNewTrackName(command) {
    const match = command.match(/(?:add|new)\s+track\s+(?:called\s+)?(\w+)/);
    if (match) {
      return match[1];
    }
    return `track${this.currentConfig.tracks.length + 1}`;
  }

  /**
   * Extract pattern/notes from command
   */
  extractPattern(command) {
    const notePattern = /[A-G][#b]?\d/gi;
    const matches = command.match(notePattern);
    return matches || [];
  }

  // ==================
  // Command implementations
  // ==================

  setBpm(bpm) {
    bpm = Math.max(40, Math.min(300, bpm));
    this.currentConfig.bpm = bpm;
    return { success: true, message: `BPM set to ${bpm}` };
  }

  setMasterGain(gain) {
    gain = Math.max(0, Math.min(1, gain));
    this.currentConfig.effects = this.currentConfig.effects || {};
    this.currentConfig.effects.masterGain = gain;
    return { success: true, message: `Master gain set to ${gain.toFixed(2)}` };
  }

  setTrackGain(trackName, gain) {
    const track = this.findTrack(trackName);
    if (!track) {
      return { success: false, message: `Track "${trackName}" not found` };
    }
    gain = Math.max(0, Math.min(1, gain));
    track.instrument.gain = gain;
    return { success: true, message: `${track.name} gain set to ${gain.toFixed(2)}` };
  }

  setWaveform(trackName, waveform) {
    const track = this.findTrack(trackName);
    if (!track) {
      return { success: false, message: `Track "${trackName}" not found` };
    }
    track.instrument.waveform = waveform;
    return { success: true, message: `${track.name} waveform changed to ${waveform}` };
  }

  setPattern(trackName, pattern) {
    const track = this.findTrack(trackName);
    if (!track) {
      return { success: false, message: `Track "${trackName}" not found` };
    }
    track.pattern = pattern;
    return { success: true, message: `${track.name} pattern updated: ${pattern.join(' ')}` };
  }

  setFilter(trackName, cutoff) {
    const track = this.findTrack(trackName);
    if (!track) {
      return { success: false, message: `Track "${trackName}" not found` };
    }
    cutoff = Math.max(20, Math.min(20000, cutoff));
    track.instrument.filter = track.instrument.filter || {};
    track.instrument.filter.cutoff = cutoff;
    return { success: true, message: `${track.name} filter cutoff set to ${cutoff}Hz` };
  }

  adjustFilter(trackName, delta) {
    const track = this.findTrack(trackName);
    if (!track) {
      return { success: false, message: `Track "${trackName}" not found` };
    }
    const currentCutoff = track.instrument.filter?.cutoff || 2000;
    return this.setFilter(trackName, currentCutoff + delta);
  }

  muteTrack(trackName) {
    const track = this.findTrack(trackName);
    if (!track) {
      return { success: false, message: `Track "${trackName}" not found` };
    }
    track.active = false;
    return { success: true, message: `${track.name} muted` };
  }

  unmuteTrack(trackName) {
    const track = this.findTrack(trackName);
    if (!track) {
      return { success: false, message: `Track "${trackName}" not found` };
    }
    track.active = true;
    return { success: true, message: `${track.name} unmuted` };
  }

  setDelay(time, feedback, mix) {
    this.currentConfig.effects = this.currentConfig.effects || {};
    this.currentConfig.effects.delay = this.currentConfig.effects.delay || {};
    
    if (time !== undefined) {
      this.currentConfig.effects.delay.time = Math.max(0, Math.min(2, time));
    }
    if (feedback !== undefined) {
      this.currentConfig.effects.delay.feedback = Math.max(0, Math.min(0.95, feedback));
    }
    if (mix !== undefined) {
      this.currentConfig.effects.delay.mix = Math.max(0, Math.min(1, mix));
    }
    
    return { success: true, message: 'Delay settings updated' };
  }

  adjustDelay(timeDelta, mixDelta) {
    const currentDelay = this.currentConfig.effects?.delay || { time: 0.25, feedback: 0.3, mix: 0.2 };
    return this.setDelay(
      currentDelay.time + (timeDelta || 0),
      currentDelay.feedback,
      currentDelay.mix + (mixDelta || 0)
    );
  }

  addTrack(name) {
    const newTrack = {
      name: name,
      instrument: {
        waveform: 'sine',
        gain: 0.3,
        envelope: { attack: 0.01, decay: 0.1, sustain: 0.7, release: 0.2 },
        filter: { cutoff: 2000 },
      },
      pattern: ['C4', 'E4', 'G4', 'E4'],
      noteLength: '8n',
      active: true,
    };
    this.currentConfig.tracks.push(newTrack);
    return { success: true, message: `Added new track: ${name}` };
  }

  removeTrack(trackName) {
    const index = this.currentConfig.tracks.findIndex(
      t => t.name.toLowerCase() === trackName.toLowerCase()
    );
    if (index === -1) {
      return { success: false, message: `Track "${trackName}" not found` };
    }
    const removed = this.currentConfig.tracks.splice(index, 1);
    return { success: true, message: `Removed track: ${removed[0].name}` };
  }

  setScale(scale) {
    // Major and minor scale patterns
    const scales = {
      major: ['C4', 'D4', 'E4', 'F4', 'G4', 'A4', 'B4', 'C5'],
      minor: ['C4', 'D4', 'Eb4', 'F4', 'G4', 'Ab4', 'Bb4', 'C5'],
    };
    
    const leadTrack = this.findTrack('lead') || this.currentConfig.tracks[0];
    if (leadTrack) {
      leadTrack.pattern = scales[scale] || scales.major;
      return { success: true, message: `Changed to ${scale} scale` };
    }
    return { success: false, message: 'No track found to update' };
  }

  /**
   * Find track by name (case-insensitive)
   */
  findTrack(name) {
    if (!name) return null;
    return this.currentConfig.tracks.find(
      t => t.name.toLowerCase() === name.toLowerCase()
    );
  }

  /**
   * Get help message with available commands
   */
  getHelp() {
    return `
Available AI Commands:
----------------------
Tempo/BPM:
  "set bpm to 140", "faster", "slower", "speed up", "slow down"

Volume:
  "volume up", "louder", "quieter", "set volume to 0.5"

Waveforms:
  "change lead to square wave", "make bass use sawtooth"
  Available: sine, square, sawtooth, triangle, noise

Tracks:
  "mute bass", "unmute lead", "add track called pad"

Filters:
  "set filter to 1000", "make lead brighter", "make bass darker"

Effects:
  "more delay", "less echo"

Patterns:
  "set lead pattern to C4 E4 G4 B4"

Scales:
  "change to major", "switch to minor"
`;
  }

  /**
   * Get current configuration summary
   */
  getStatus() {
    if (!this.currentConfig) {
      this.loadConfig();
    }
    
    const tracks = this.currentConfig.tracks.map(t => 
      `  ${t.active ? '▶' : '⏸'} ${t.name}: ${t.instrument.waveform} | Pattern: ${t.pattern.join(' ')}`
    ).join('\n');
    
    return `
Music Status:
-------------
BPM: ${this.currentConfig.bpm}
Master Volume: ${(this.currentConfig.effects?.masterGain || 0.7).toFixed(2)}
Delay: ${this.currentConfig.effects?.delay?.mix || 0.2} mix

Tracks:
${tracks}
`;
  }
}

/**
 * Create AI agent for music control
 * @param {string} configPath - Path to music configuration file
 * @param {Function} onConfigUpdate - Callback when config changes
 * @returns {MusicAgent} - Music agent instance
 */
export function createMusicAgent(configPath, onConfigUpdate) {
  return new MusicAgent(configPath, onConfigUpdate);
}
