/**
 * Tests for the AI agent module
 */

import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert';
import fs from 'fs';
import path from 'path';
import os from 'os';

import { MusicAgent } from './agent.js';

describe('MusicAgent', () => {
  let tempDir;
  let configPath;
  let agent;
  let lastConfig;

  beforeEach(() => {
    // Create a temp config file for testing
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'synthagent-test-'));
    configPath = path.join(tempDir, 'test-music.txt');
    
    // Write initial config
    fs.writeFileSync(configPath, `
BPM: 120
MasterGain: 0.7

Delay.Time: 0.25
Delay.Feedback: 0.3
Delay.Mix: 0.2

Track: lead
Waveform: sine
Gain: 0.3
Filter: 2000
Pattern: C4 E4 G4 E4
Active: true

Track: bass
Waveform: square
Gain: 0.4
Filter: 500
Pattern: C3 G3
Active: true
`);

    lastConfig = null;
    agent = new MusicAgent(configPath, (config) => {
      lastConfig = config;
    });
  });

  it('should load initial configuration', () => {
    assert.strictEqual(agent.currentConfig.bpm, 120);
    assert.strictEqual(agent.currentConfig.tracks.length, 2);
  });

  it('should execute setBpm command', async () => {
    const result = await agent.executeCommand('set bpm to 140');
    assert.strictEqual(result.success, true);
    assert.strictEqual(agent.currentConfig.bpm, 140);
  });

  it('should handle "faster" command', async () => {
    const initialBpm = agent.currentConfig.bpm;
    const result = await agent.executeCommand('make it faster');
    assert.strictEqual(result.success, true);
    assert.strictEqual(agent.currentConfig.bpm > initialBpm, true);
  });

  it('should handle "slower" command', async () => {
    const initialBpm = agent.currentConfig.bpm;
    const result = await agent.executeCommand('slow down');
    assert.strictEqual(result.success, true);
    assert.strictEqual(agent.currentConfig.bpm < initialBpm, true);
  });

  it('should handle volume commands', async () => {
    const result = await agent.executeCommand('louder');
    assert.strictEqual(result.success, true);
    assert.strictEqual(agent.currentConfig.effects.masterGain > 0.7, true);
  });

  it('should handle quieter command', async () => {
    const result = await agent.executeCommand('quieter');
    assert.strictEqual(result.success, true);
    assert.strictEqual(agent.currentConfig.effects.masterGain < 0.7, true);
  });

  it('should change waveform', async () => {
    const result = await agent.executeCommand('change lead to square');
    assert.strictEqual(result.success, true);
    
    const leadTrack = agent.currentConfig.tracks.find(t => t.name === 'lead');
    assert.strictEqual(leadTrack.instrument.waveform, 'square');
  });

  it('should mute a track', async () => {
    const result = await agent.executeCommand('mute bass');
    assert.strictEqual(result.success, true);
    
    const bassTrack = agent.currentConfig.tracks.find(t => t.name === 'bass');
    assert.strictEqual(bassTrack.active, false);
  });

  it('should unmute a track', async () => {
    // First mute
    await agent.executeCommand('mute lead');
    
    // Then unmute
    const result = await agent.executeCommand('unmute lead');
    assert.strictEqual(result.success, true);
    
    const leadTrack = agent.currentConfig.tracks.find(t => t.name === 'lead');
    assert.strictEqual(leadTrack.active, true);
  });

  it('should set filter cutoff', async () => {
    const result = await agent.executeCommand('set lead filter to 3000');
    assert.strictEqual(result.success, true);
    
    const leadTrack = agent.currentConfig.tracks.find(t => t.name === 'lead');
    assert.strictEqual(leadTrack.instrument.filter.cutoff, 3000);
  });

  it('should handle "brighter" command', async () => {
    const initialCutoff = agent.currentConfig.tracks[0].instrument.filter.cutoff;
    const result = await agent.executeCommand('make lead brighter');
    assert.strictEqual(result.success, true);
    assert.strictEqual(agent.currentConfig.tracks[0].instrument.filter.cutoff > initialCutoff, true);
  });

  it('should handle "darker" command', async () => {
    const initialCutoff = agent.currentConfig.tracks[0].instrument.filter.cutoff;
    const result = await agent.executeCommand('make lead darker');
    assert.strictEqual(result.success, true);
    assert.strictEqual(agent.currentConfig.tracks[0].instrument.filter.cutoff < initialCutoff, true);
  });

  it('should adjust delay', async () => {
    const initialMix = agent.currentConfig.effects.delay.mix;
    const result = await agent.executeCommand('more delay');
    assert.strictEqual(result.success, true);
    assert.strictEqual(agent.currentConfig.effects.delay.mix > initialMix, true);
  });

  it('should add a new track', async () => {
    const initialCount = agent.currentConfig.tracks.length;
    const result = await agent.executeCommand('add track called pad');
    assert.strictEqual(result.success, true);
    assert.strictEqual(agent.currentConfig.tracks.length, initialCount + 1);
    
    const padTrack = agent.currentConfig.tracks.find(t => t.name === 'pad');
    assert.strictEqual(padTrack !== undefined, true);
  });

  it('should remove a track', async () => {
    const initialCount = agent.currentConfig.tracks.length;
    const result = await agent.executeCommand('remove track bass');
    assert.strictEqual(result.success, true);
    assert.strictEqual(agent.currentConfig.tracks.length, initialCount - 1);
    
    const bassTrack = agent.currentConfig.tracks.find(t => t.name === 'bass');
    assert.strictEqual(bassTrack, undefined);
  });

  it('should change to major scale', async () => {
    const result = await agent.executeCommand('change to major');
    assert.strictEqual(result.success, true);
  });

  it('should change to minor scale', async () => {
    const result = await agent.executeCommand('change to minor');
    assert.strictEqual(result.success, true);
  });

  it('should return error for unknown commands', async () => {
    const result = await agent.executeCommand('do something random xyz');
    assert.strictEqual(result.success, false);
  });

  it('should clamp BPM to valid range', async () => {
    await agent.executeCommand('set bpm to 500');
    assert.strictEqual(agent.currentConfig.bpm <= 300, true);
    
    agent.currentConfig.bpm = 120;
    await agent.executeCommand('set bpm to 10');
    assert.strictEqual(agent.currentConfig.bpm >= 40, true);
  });

  it('should provide help text', () => {
    const help = agent.getHelp();
    assert.strictEqual(help.includes('BPM'), true);
    assert.strictEqual(help.includes('Volume'), true);
    assert.strictEqual(help.includes('Waveforms'), true);
  });

  it('should provide status', () => {
    const status = agent.getStatus();
    assert.strictEqual(status.includes('BPM'), true);
    assert.strictEqual(status.includes('lead'), true);
    assert.strictEqual(status.includes('bass'), true);
  });
});
