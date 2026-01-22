# 🎵 SynthAgent

A terminal-based synthesizer and programmatic music maker that lets you edit a text document live to change the music in real-time. It also includes an AI agent mode that allows you to modify the music loop using natural language commands, designed for integration with the GitHub Copilot SDK.

## Features

- **Live Music Editing**: Edit a simple text file (`music.txt`) and hear changes in real-time
- **Multiple Tracks**: Support for multiple instrument tracks (lead, bass, percussion, etc.)
- **Waveform Synthesis**: Sine, square, sawtooth, triangle, and noise waveforms
- **Effects**: Built-in delay effect with configurable parameters
- **ADSR Envelopes**: Attack, decay, sustain, and release controls for each track
- **Filters**: Low-pass filter with adjustable cutoff frequency
- **AI Control**: Natural language commands to modify the music (AI Mode)
- **Terminal UI**: Visual feedback with audio visualizer and track status

## Installation

```bash
# Clone the repository
git clone https://github.com/Lukasedv/synthagent.git
cd synthagent

# Install dependencies (if any)
npm install
```

## Usage

### Standard Mode

Start the synth player with the terminal UI:

```bash
npm start
```

**Keyboard Controls:**
- `Space` - Play/Pause
- `↑/↓` - Adjust BPM
- `←/→` - Adjust Volume
- `R` - Reload configuration
- `Q` - Quit

### AI Mode

Start the AI command mode for natural language music control:

```bash
npm run ai
```

**Example Commands:**
```
🎤 AI> set bpm to 140
✓ BPM set to 140

🎤 AI> make it faster
✓ BPM set to 150

🎤 AI> change lead to square wave
✓ lead waveform changed to square

🎤 AI> mute the bass
✓ bass muted

🎤 AI> add more delay
✓ Delay settings updated

🎤 AI> change to minor
✓ Changed to minor scale
```

## Music Configuration

The music is defined in a simple text file format (`music.txt`). When you save changes to this file, the music updates automatically!

### Configuration Format

```
# Global Settings
BPM: 120
MasterGain: 0.7

# Delay Effect
Delay.Time: 0.25
Delay.Feedback: 0.3
Delay.Mix: 0.2

# Track Definition
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

Track: bass
Waveform: sine
Gain: 0.4
Filter: 500
Pattern: C3 - C3 - G3 - G3 -
NoteLength: 8n
Active: true

Track: hihat
Waveform: noise
Gain: 0.12
Filter: 8000
Pattern: X - X - X - X -
NoteLength: 8n
Active: true
```

### Configuration Options

| Option | Description | Range |
|--------|-------------|-------|
| `BPM` | Tempo in beats per minute | 40-300 |
| `MasterGain` | Master volume | 0-1 |
| `Delay.Time` | Delay time in seconds | 0-2 |
| `Delay.Feedback` | Delay feedback amount | 0-0.95 |
| `Delay.Mix` | Dry/wet mix | 0-1 |

### Track Options

| Option | Description | Values |
|--------|-------------|--------|
| `Track` | Track name | Any string |
| `Waveform` | Sound type | sine, square, sawtooth, triangle, noise |
| `Gain` | Track volume | 0-1 |
| `Filter` | Low-pass filter cutoff | 20-20000 Hz |
| `Attack` | Envelope attack time | 0-2 seconds |
| `Decay` | Envelope decay time | 0-2 seconds |
| `Sustain` | Sustain level | 0-1 |
| `Release` | Envelope release time | 0-2 seconds |
| `Pattern` | Note sequence | Space-separated notes |
| `NoteLength` | Duration of each note | 1n, 2n, 4n, 8n, 16n, 32n |
| `Active` | Enable/disable track | true/false |

### Pattern Notes

- **Notes**: C3-C6 (e.g., C4, D#4, Bb3)
- **Rest**: Use `-` for silence
- **Percussion**: Use `X` for a percussion hit

## AI Agent Commands

The AI mode understands natural language commands:

### Tempo
- "set bpm to 140"
- "faster" / "slower"
- "speed up" / "slow down"

### Volume
- "louder" / "quieter"
- "volume up" / "volume down"
- "set volume to 0.5"

### Waveforms
- "change lead to square wave"
- "make bass use sawtooth"

### Tracks
- "mute bass"
- "unmute lead"
- "add track called pad"

### Filters
- "set filter to 1000"
- "make lead brighter"
- "make bass darker"

### Effects
- "more delay"
- "less delay"

### Scales
- "change to major"
- "change to minor"

## GitHub Copilot SDK Integration

SynthAgent is designed to integrate with the GitHub Copilot SDK for enhanced AI capabilities. The `MusicAgent` class (`src/ai/agent.js`) provides:

- Natural language command interpretation
- Real-time configuration updates
- Command history tracking
- Extensible command registry

To integrate with the Copilot SDK:

```javascript
import { CopilotClient } from '@github/copilot-sdk';
import { MusicAgent } from './ai/agent.js';

const copilot = new CopilotClient();
const agent = new MusicAgent('music.txt', onConfigUpdate);

// Use Copilot to enhance command interpretation
const session = await copilot.createSession();
const response = await session.send({
  prompt: userCommand,
  context: agent.getStatus()
});
```

## Project Structure

```
synthagent/
├── src/
│   ├── index.js          # Main entry point (terminal UI mode)
│   ├── ai-mode.js        # AI command mode entry point
│   ├── audio/
│   │   ├── synth.js      # Core synthesis (oscillators, effects)
│   │   └── sequencer.js  # Pattern sequencing and playback
│   ├── config/
│   │   └── parser.js     # Configuration file parser
│   ├── ai/
│   │   └── agent.js      # AI agent for music control
│   └── ui/
│       └── terminal.js   # Terminal UI components
├── music.txt             # Music configuration (auto-created)
├── package.json
└── README.md
```

## Requirements

- Node.js 18.0.0 or higher
- A terminal that supports ANSI escape codes

## Note on Audio Playback

The current implementation generates audio data in memory for timing and visualization purposes. For actual audio output on your system, you would need to integrate with:

- **naudiodon** - Cross-platform audio I/O
- **@picovoice/pvspeaker-node** - PCM audio playback

The synthesis engine produces standard PCM audio data (44100 Hz, 16-bit, mono) that can be piped to any audio output.

## License

MIT