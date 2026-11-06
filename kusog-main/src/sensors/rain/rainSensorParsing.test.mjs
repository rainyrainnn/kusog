import assert from 'node:assert/strict';
import test from 'node:test';
import { isRainDetected, parseRainApiResponse } from './rainSensorParsing.ts';

test('detects rain from supported rain-state text', () => {
  for (const state of ['rain', 'raining', 'heavy rain', 'drizzle']) {
    assert.equal(isRainDetected(state), true, `${state} should indicate rain`);
  }
});

test('does not report rain for dry, normal, or explicit no-rain states', () => {
  for (const state of ['normal', 'dry', 'clear', 'no rain', 'not raining', 'unknown']) {
    assert.equal(isRainDetected(state), false, `${state} should not indicate rain`);
  }
});

test('parses the connected Pi API sensor payload without inventing a sample timestamp', () => {
  const reading = parseRainApiResponse({
    connected: true,
    sensor: {
      rain_level: 'raw-level',
      rain_state: 'normal',
      rain_24h: 12,
      battery_percentage: 83,
    },
  });

  assert.deepEqual(reading, {
    connected: true,
    rainLevel: 'raw-level',
    rainState: 'normal',
    rain24h: 12,
    batteryPercentage: 83,
  });
  assert.equal('recordedAt' in reading, false);
});

test('disconnected API responses stay disconnected and preserve a useful error', () => {
  assert.deepEqual(parseRainApiResponse({ connected: false, error: 'sensor unavailable' }), {
    connected: false,
    error: 'sensor unavailable',
  });
});

test('rejects invalid connected payloads and out-of-range measurements', () => {
  assert.throws(() => parseRainApiResponse({ connected: true, sensor: {} }), /rain_level or rain_state/);
  assert.throws(() => parseRainApiResponse({
    connected: true,
    sensor: { rain_level: 'x', rain_state: 'normal', rain_24h: -1 },
  }), /invalid rain_24h/);
  assert.throws(() => parseRainApiResponse({
    connected: true,
    sensor: { rain_level: 'x', rain_state: 'normal', battery_percentage: 101 },
  }), /invalid battery_percentage/);
  assert.throws(() => parseRainApiResponse({ connected: true }), /sensor object/);
});
