#!/usr/bin/env node
/**
 * SynthAgent - Terminal-based synth/music maker
 * 
 * A live-coding music environment where you can edit a text file
 * and hear changes in real-time. Also supports AI-controlled
 * music modification via natural language commands.
 * 
 * Usage:
 *   npm start           - Start the synth player
 *   npm run ai          - Start with AI command mode
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import readline from 'readline';

import { Sequencer } from './audio/sequencer.js';
import { parseConfig, loadConfigFile, createDefaultConfigFile, FileWatcher } from './config/parser.js';
import { TerminalUI, clearScreen, showCursor } from './ui/terminal.js';
import { SAMPLE_RATE, BIT_DEPTH, CHANNELS } from './audio/synth.js';

// Get current directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

// Default config file path
const CONFIG_FILE = path.join(rootDir, 'music.txt');

/**
 * Main SynthAgent application
 */
class SynthAgent {
  constructor(options = {}) {
    this.configPath = options.configPath || CONFIG_FILE;
    this.sequencer = null;
    this.fileWatcher = null;
    this.ui = null;
    this.isRunning = false;
    this.audioSimulation = options.simulation !== false;
    this.renderInterval = null;
    this.audioInterval = null;
  }

  /**
   * Initialize the application
   */
  async init() {
    console.log('🎵 SynthAgent - Terminal Music Maker');
    console.log('====================================\n');

    // Create config file if it doesn't exist
    if (!fs.existsSync(this.configPath)) {
      console.log(`Creating default music configuration at: ${this.configPath}`);
      createDefaultConfigFile(this.configPath);
    }

    // Load configuration
    const config = loadConfigFile(this.configPath);
    if (!config) {
      console.error('Failed to load configuration. Exiting.');
      process.exit(1);
    }

    console.log(`Loaded configuration from: ${this.configPath}`);
    console.log(`  BPM: ${config.bpm}`);
    console.log(`  Tracks: ${config.tracks.length}`);
    for (const track of config.tracks) {
      console.log(`    - ${track.name} (${track.instrument.waveform})`);
    }
    console.log('');

    // Initialize sequencer
    this.sequencer = new Sequencer(config);

    // Initialize file watcher
    this.fileWatcher = new FileWatcher(this.configPath, (newConfig) => {
      this.onConfigChange(newConfig);
    });

    // Initialize UI
    this.ui = new TerminalUI();
    this.ui.setConfig(config);

    return true;
  }

  /**
   * Handle configuration changes from file watcher
   */
  onConfigChange(newConfig) {
    if (this.ui) {
      this.ui.log(`Config updated: BPM ${newConfig.bpm}, ${newConfig.tracks.length} tracks`);
      this.ui.setConfig(newConfig);
    }
    
    if (this.sequencer) {
      this.sequencer.updateConfig(newConfig);
    }
  }

  /**
   * Start the application
   */
  async start() {
    this.isRunning = true;

    // Start file watcher
    this.fileWatcher.start();

    // Initialize UI
    this.ui.init();
    this.ui.log('SynthAgent started. Press SPACE to play/pause.');
    this.ui.log(`Edit ${path.basename(this.configPath)} to change music live!`);

    // Set up keyboard input
    this.setupKeyboardInput();

    // Start rendering loop
    this.startRenderLoop();

    // Start audio simulation (for visual feedback)
    this.startAudioLoop();

    // Handle exit signals
    process.on('SIGINT', () => this.shutdown());
    process.on('SIGTERM', () => this.shutdown());
  }

  /**
   * Set up keyboard input handling
   */
  setupKeyboardInput() {
    readline.emitKeypressEvents(process.stdin);
    if (process.stdin.isTTY) {
      process.stdin.setRawMode(true);
    }

    process.stdin.on('keypress', (str, key) => {
      if (key.ctrl && key.name === 'c') {
        this.shutdown();
        return;
      }

      switch (key.name) {
        case 'space':
          this.togglePlayback();
          break;
        case 'q':
          this.shutdown();
          break;
        case 'r':
          this.reloadConfig();
          break;
        case 'up':
          this.adjustBpm(5);
          break;
        case 'down':
          this.adjustBpm(-5);
          break;
        case 'right':
          this.adjustVolume(0.05);
          break;
        case 'left':
          this.adjustVolume(-0.05);
          break;
      }
    });
  }

  /**
   * Toggle playback
   */
  togglePlayback() {
    if (this.sequencer.isPlaying) {
      this.sequencer.stop();
      this.ui.setPlaying(false);
      this.ui.log('Playback paused');
    } else {
      this.sequencer.start();
      this.ui.setPlaying(true);
      this.ui.log('Playback started');
    }
  }

  /**
   * Reload configuration from file
   */
  reloadConfig() {
    const config = loadConfigFile(this.configPath);
    if (config) {
      this.sequencer.updateConfig(config);
      this.ui.setConfig(config);
      this.ui.log('Configuration reloaded');
    } else {
      this.ui.log('Failed to reload configuration');
    }
  }

  /**
   * Adjust BPM
   */
  adjustBpm(delta) {
    const newBpm = Math.max(40, Math.min(300, this.sequencer.bpm + delta));
    this.sequencer.updateConfig({ bpm: newBpm });
    this.ui.setConfig(this.sequencer.getConfig());
    this.ui.log(`BPM: ${newBpm}`);
  }

  /**
   * Adjust master volume
   */
  adjustVolume(delta) {
    const currentGain = this.sequencer.masterGain;
    const newGain = Math.max(0, Math.min(1, currentGain + delta));
    this.sequencer.updateConfig({ 
      effects: { masterGain: newGain }
    });
    this.ui.setConfig(this.sequencer.getConfig());
    this.ui.log(`Volume: ${Math.round(newGain * 100)}%`);
  }

  /**
   * Start the UI render loop
   */
  startRenderLoop() {
    this.renderInterval = setInterval(() => {
      if (this.isRunning) {
        this.ui.setPosition(this.sequencer.getPosition());
        this.ui.render();
      }
    }, 50); // 20 FPS
  }

  /**
   * Start the audio simulation loop
   * In a real environment with audio hardware, this would pipe to speakers
   */
  startAudioLoop() {
    const samplesPerFrame = Math.floor(SAMPLE_RATE / 20); // 20 FPS equivalent
    
    this.audioInterval = setInterval(() => {
      if (this.isRunning && this.sequencer.isPlaying) {
        // Generate samples (for timing and visualization)
        const buffer = this.sequencer.generateSamples(samplesPerFrame);
        
        // Extract a sample for visualization
        if (buffer.length >= 2) {
          const sample = buffer.readInt16LE(0) / 32768;
          this.ui.updateVisualizer(sample);
        }
      } else {
        // When not playing, show flat line in visualizer
        this.ui.updateVisualizer(0);
      }
    }, 50);
  }

  /**
   * Shutdown the application
   */
  shutdown() {
    this.isRunning = false;
    
    if (this.renderInterval) {
      clearInterval(this.renderInterval);
    }
    if (this.audioInterval) {
      clearInterval(this.audioInterval);
    }
    if (this.fileWatcher) {
      this.fileWatcher.stop();
    }
    if (this.sequencer) {
      this.sequencer.stop();
    }
    if (this.ui) {
      this.ui.cleanup();
    }

    console.log('\n🎵 SynthAgent stopped. Goodbye!');
    process.exit(0);
  }
}

// Main entry point
async function main() {
  const app = new SynthAgent({
    configPath: CONFIG_FILE,
    simulation: true, // Use simulation mode for environments without audio hardware
  });

  try {
    await app.init();
    await app.start();
  } catch (err) {
    console.error('Error starting SynthAgent:', err.message);
    process.exit(1);
  }
}

// Run if executed directly
main();
