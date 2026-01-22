/**
 * Terminal UI - Provides visual feedback and controls in the terminal
 * Uses ANSI escape codes for cross-platform compatibility
 */

import readline from 'readline';

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
  white: '\x1b[37m',
  bgBlack: '\x1b[40m',
  bgGreen: '\x1b[42m',
  bgBlue: '\x1b[44m',
};

/**
 * Clear the terminal screen
 */
export function clearScreen() {
  process.stdout.write('\x1b[2J\x1b[H');
}

/**
 * Move cursor to position
 */
export function moveCursor(row, col) {
  process.stdout.write(`\x1b[${row};${col}H`);
}

/**
 * Hide cursor
 */
export function hideCursor() {
  process.stdout.write('\x1b[?25l');
}

/**
 * Show cursor
 */
export function showCursor() {
  process.stdout.write('\x1b[?25h');
}

/**
 * Terminal UI class
 */
export class TerminalUI {
  constructor() {
    this.width = process.stdout.columns || 80;
    this.height = process.stdout.rows || 24;
    this.isPlaying = false;
    this.config = null;
    this.position = { bar: 0, step: 0 };
    this.logs = [];
    this.maxLogs = 5;
    this.visualizerData = new Array(32).fill(0);
    
    // Handle terminal resize
    process.stdout.on('resize', () => {
      this.width = process.stdout.columns || 80;
      this.height = process.stdout.rows || 24;
    });
  }

  /**
   * Initialize the UI
   */
  init() {
    clearScreen();
    hideCursor();
    this.render();
  }

  /**
   * Clean up UI on exit
   */
  cleanup() {
    showCursor();
    clearScreen();
  }

  /**
   * Update playback state
   */
  setPlaying(isPlaying) {
    this.isPlaying = isPlaying;
  }

  /**
   * Update configuration
   */
  setConfig(config) {
    this.config = config;
  }

  /**
   * Update playback position
   */
  setPosition(position) {
    this.position = position;
  }

  /**
   * Add log message
   */
  log(message) {
    this.logs.push({ time: new Date(), message });
    if (this.logs.length > this.maxLogs) {
      this.logs.shift();
    }
  }

  /**
   * Update visualizer data
   */
  updateVisualizer(sample) {
    // Shift visualizer data left
    this.visualizerData.shift();
    this.visualizerData.push(Math.abs(sample));
  }

  /**
   * Render the UI
   */
  render() {
    const lines = [];
    
    // Header
    lines.push(this.renderHeader());
    lines.push('');
    
    // Status bar
    lines.push(this.renderStatusBar());
    lines.push('');
    
    // Visualizer
    lines.push(this.renderVisualizer());
    lines.push('');
    
    // Track info
    if (this.config && this.config.tracks) {
      lines.push(this.renderTracks());
    }
    lines.push('');
    
    // Logs
    lines.push(this.renderLogs());
    lines.push('');
    
    // Help/controls
    lines.push(this.renderControls());
    
    // Output
    moveCursor(1, 1);
    process.stdout.write(lines.join('\n'));
  }

  /**
   * Render header
   */
  renderHeader() {
    const title = ' 🎵 SynthAgent - Live Music Maker ';
    const padding = Math.max(0, Math.floor((this.width - title.length) / 2));
    return `${Colors.bright}${Colors.cyan}${'═'.repeat(padding)}${title}${'═'.repeat(padding)}${Colors.reset}`;
  }

  /**
   * Render status bar
   */
  renderStatusBar() {
    const playState = this.isPlaying 
      ? `${Colors.green}▶ PLAYING${Colors.reset}` 
      : `${Colors.yellow}⏸ PAUSED${Colors.reset}`;
    
    const bpm = this.config?.bpm || 120;
    const bar = this.position.bar + 1;
    const step = this.position.step + 1;
    const volume = Math.round((this.config?.effects?.masterGain || 0.7) * 100);
    
    return `${playState}  │  BPM: ${Colors.bright}${bpm}${Colors.reset}  │  ` +
           `Bar: ${bar}  Beat: ${step}  │  Vol: ${volume}%`;
  }

  /**
   * Render audio visualizer
   */
  renderVisualizer() {
    const maxHeight = 6;
    const chars = ['▁', '▂', '▃', '▄', '▅', '▆', '▇', '█'];
    
    let viz = `${Colors.dim}Visualizer:${Colors.reset} `;
    
    for (const value of this.visualizerData) {
      const normalized = Math.min(1, value * 3);
      const charIndex = Math.floor(normalized * (chars.length - 1));
      const color = normalized > 0.7 ? Colors.red : normalized > 0.4 ? Colors.yellow : Colors.green;
      viz += `${color}${chars[charIndex]}${Colors.reset}`;
    }
    
    return viz;
  }

  /**
   * Render track information
   */
  renderTracks() {
    if (!this.config?.tracks) return '';
    
    const lines = [`${Colors.bright}Tracks:${Colors.reset}`];
    
    for (const track of this.config.tracks) {
      const status = track.active ? `${Colors.green}●${Colors.reset}` : `${Colors.dim}○${Colors.reset}`;
      const waveIcon = this.getWaveformIcon(track.instrument?.waveform);
      const pattern = track.pattern?.slice(0, 8).join(' ') || '';
      const patternDisplay = pattern.length > 30 ? pattern.substring(0, 27) + '...' : pattern;
      
      lines.push(`  ${status} ${waveIcon} ${Colors.bright}${track.name.padEnd(12)}${Colors.reset} │ ${patternDisplay}`);
    }
    
    return lines.join('\n');
  }

  /**
   * Get icon for waveform type
   */
  getWaveformIcon(waveform) {
    const icons = {
      sine: '∿',
      square: '⊓',
      sawtooth: '⋀',
      triangle: '△',
      noise: '▒',
    };
    return icons[waveform] || '♪';
  }

  /**
   * Render log messages
   */
  renderLogs() {
    const lines = [`${Colors.dim}─── Log ───${Colors.reset}`];
    
    for (const log of this.logs.slice(-this.maxLogs)) {
      const time = log.time.toLocaleTimeString();
      lines.push(`${Colors.dim}[${time}]${Colors.reset} ${log.message}`);
    }
    
    // Pad empty lines
    while (lines.length <= this.maxLogs) {
      lines.push('');
    }
    
    return lines.join('\n');
  }

  /**
   * Render controls help
   */
  renderControls() {
    return `${Colors.dim}─── Controls ───${Colors.reset}
${Colors.cyan}Space${Colors.reset}: Play/Pause  │  ${Colors.cyan}Q${Colors.reset}: Quit  │  ${Colors.cyan}R${Colors.reset}: Reload Config
${Colors.dim}Edit music.txt to change the music live!${Colors.reset}`;
  }
}

/**
 * Simple progress bar for CLI feedback
 */
export function progressBar(current, total, width = 20) {
  const progress = Math.min(1, current / total);
  const filled = Math.round(progress * width);
  const empty = width - filled;
  return `[${'█'.repeat(filled)}${'░'.repeat(empty)}] ${Math.round(progress * 100)}%`;
}

/**
 * Format time in MM:SS
 */
export function formatTime(seconds) {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

/**
 * Create a simple spinner
 */
export class Spinner {
  constructor(message = 'Loading') {
    this.message = message;
    this.frames = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
    this.frameIndex = 0;
    this.interval = null;
  }

  start() {
    this.interval = setInterval(() => {
      const frame = this.frames[this.frameIndex];
      process.stdout.write(`\r${Colors.cyan}${frame}${Colors.reset} ${this.message}`);
      this.frameIndex = (this.frameIndex + 1) % this.frames.length;
    }, 80);
  }

  stop(finalMessage = '') {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
      process.stdout.write(`\r${finalMessage || this.message}${' '.repeat(20)}\n`);
    }
  }
}
