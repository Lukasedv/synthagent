#!/usr/bin/env node
/**
 * SynthAgent AI Mode - Control music with natural language commands
 * 
 * This mode allows you to control the music loop using natural language
 * commands interpreted by the AI agent. It integrates with the GitHub
 * Copilot SDK for enhanced AI capabilities.
 * 
 * Usage:
 *   npm run ai
 *   node src/ai-mode.js
 * 
 * Example commands:
 *   "set bpm to 140"
 *   "make it faster"
 *   "change lead to square wave"
 *   "mute the bass"
 *   "add more delay"
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import readline from 'readline';

import { Sequencer } from './audio/sequencer.js';
import { parseConfig, loadConfigFile, createDefaultConfigFile, FileWatcher } from './config/parser.js';
import { MusicAgent } from './ai/agent.js';
import { SAMPLE_RATE } from './audio/synth.js';

// Get current directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

// Default config file path
const CONFIG_FILE = path.join(rootDir, 'music.txt');

// ANSI color codes
const Colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
};

/**
 * Print styled header
 */
function printHeader() {
  console.log(`
${Colors.cyan}╔══════════════════════════════════════════════════════════════╗
║  ${Colors.bright}🎵 SynthAgent AI Mode ${Colors.reset}${Colors.cyan}                                      ║
║  ${Colors.dim}Control your music with natural language commands${Colors.reset}${Colors.cyan}           ║
╚══════════════════════════════════════════════════════════════╝${Colors.reset}
`);
}

/**
 * Print prompt
 */
function printPrompt() {
  process.stdout.write(`\n${Colors.cyan}🎤 AI>${Colors.reset} `);
}

/**
 * Print status
 */
function printStatus(sequencer, config) {
  const playState = sequencer.isPlaying 
    ? `${Colors.green}▶ PLAYING${Colors.reset}` 
    : `${Colors.yellow}⏸ PAUSED${Colors.reset}`;
  
  console.log(`\n${Colors.dim}─── Status ───${Colors.reset}`);
  console.log(`${playState}  │  BPM: ${config.bpm}  │  Tracks: ${config.tracks.length}`);
  
  for (const track of config.tracks) {
    const status = track.active ? `${Colors.green}●${Colors.reset}` : `${Colors.dim}○${Colors.reset}`;
    console.log(`  ${status} ${track.name}: ${track.instrument.waveform} - ${track.pattern.slice(0, 4).join(' ')}...`);
  }
}

/**
 * Print help
 */
function printHelp() {
  console.log(`
${Colors.bright}Available Commands:${Colors.reset}

${Colors.cyan}Playback:${Colors.reset}
  play, start          - Start playback
  stop, pause          - Stop playback
  status               - Show current status

${Colors.cyan}Tempo:${Colors.reset}
  "set bpm to 140"     - Set specific BPM
  "faster", "speed up" - Increase tempo
  "slower", "slow down"- Decrease tempo

${Colors.cyan}Volume:${Colors.reset}
  "louder", "volume up"   - Increase volume
  "quieter", "softer"     - Decrease volume
  "set volume to 0.5"     - Set specific volume

${Colors.cyan}Waveforms:${Colors.reset}
  "change lead to square" - Change track waveform
  Available: sine, square, sawtooth, triangle, noise

${Colors.cyan}Tracks:${Colors.reset}
  "mute bass"          - Mute a track
  "unmute lead"        - Unmute a track
  "add track called pad" - Add new track

${Colors.cyan}Filters:${Colors.reset}
  "set filter to 1000" - Set filter cutoff
  "make lead brighter" - Increase filter cutoff
  "make bass darker"   - Decrease filter cutoff

${Colors.cyan}Effects:${Colors.reset}
  "more delay"         - Increase delay effect
  "less delay"         - Decrease delay effect

${Colors.cyan}Scales:${Colors.reset}
  "change to major"    - Use major scale pattern
  "change to minor"    - Use minor scale pattern

${Colors.cyan}Other:${Colors.reset}
  help                 - Show this help
  quit, exit           - Exit AI mode
`);
}

/**
 * Main AI Mode application
 */
async function main() {
  printHeader();

  // Create config file if it doesn't exist
  if (!fs.existsSync(CONFIG_FILE)) {
    console.log(`Creating default music configuration at: ${CONFIG_FILE}`);
    createDefaultConfigFile(CONFIG_FILE);
  }

  // Load configuration
  const config = loadConfigFile(CONFIG_FILE);
  if (!config) {
    console.error('Failed to load configuration. Exiting.');
    process.exit(1);
  }

  console.log(`${Colors.dim}Loaded: ${CONFIG_FILE}${Colors.reset}`);

  // Initialize sequencer
  const sequencer = new Sequencer(config);

  // Initialize AI agent
  const agent = new MusicAgent(CONFIG_FILE, (newConfig) => {
    sequencer.updateConfig(newConfig);
    console.log(`${Colors.green}✓ Configuration updated${Colors.reset}`);
  });

  // Initialize file watcher for live editing
  const watcher = new FileWatcher(CONFIG_FILE, (newConfig) => {
    sequencer.updateConfig(newConfig);
    console.log(`\n${Colors.yellow}📝 Config file changed - music updated${Colors.reset}`);
    printPrompt();
  });
  watcher.start();

  // Start audio loop (simulation for visualization)
  let audioInterval = null;
  const startAudioLoop = () => {
    const samplesPerFrame = Math.floor(SAMPLE_RATE / 20);
    audioInterval = setInterval(() => {
      if (sequencer.isPlaying) {
        sequencer.generateSamples(samplesPerFrame);
      }
    }, 50);
  };
  startAudioLoop();

  // Set up readline interface
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  // Show initial status
  printStatus(sequencer, config);
  console.log(`\n${Colors.dim}Type 'help' for available commands, 'quit' to exit${Colors.reset}`);
  
  printPrompt();

  // Handle commands
  rl.on('line', async (input) => {
    const command = input.trim().toLowerCase();
    
    if (!command) {
      printPrompt();
      return;
    }

    // Built-in commands
    if (command === 'help' || command === '?') {
      printHelp();
      printPrompt();
      return;
    }

    if (command === 'quit' || command === 'exit' || command === 'q') {
      console.log(`\n${Colors.cyan}🎵 Goodbye!${Colors.reset}\n`);
      watcher.stop();
      if (audioInterval) clearInterval(audioInterval);
      rl.close();
      process.exit(0);
      return;
    }

    if (command === 'play' || command === 'start') {
      sequencer.start();
      console.log(`${Colors.green}▶ Playback started${Colors.reset}`);
      printPrompt();
      return;
    }

    if (command === 'stop' || command === 'pause') {
      sequencer.stop();
      console.log(`${Colors.yellow}⏸ Playback paused${Colors.reset}`);
      printPrompt();
      return;
    }

    if (command === 'status') {
      printStatus(sequencer, sequencer.getConfig());
      printPrompt();
      return;
    }

    // Send to AI agent
    try {
      console.log(`${Colors.dim}Processing...${Colors.reset}`);
      const result = await agent.executeCommand(input);
      
      if (result.success) {
        console.log(`${Colors.green}✓ ${result.message}${Colors.reset}`);
      } else {
        console.log(`${Colors.yellow}⚠ ${result.message}${Colors.reset}`);
      }
    } catch (err) {
      console.log(`${Colors.red}✗ Error: ${err.message}${Colors.reset}`);
    }

    printPrompt();
  });

  // Handle close
  rl.on('close', () => {
    watcher.stop();
    if (audioInterval) clearInterval(audioInterval);
    process.exit(0);
  });
}

// Run
main().catch(err => {
  console.error(`${Colors.red}Error: ${err.message}${Colors.reset}`);
  process.exit(1);
});
