import assert from 'node:assert/strict';
import test from 'node:test';
import { presentSavedRainReading } from './rainLogPresentation.ts';

test('Test Log presentation uses database-saved values and recorded_at, not live API state', () => {
  assert.deepEqual(presentSavedRainReading({
    rain_reading_level: 'heavy',
    rain_reading_state: 'raining',
    rain_reading_24h: 12.5,
    rain_reading_battery_percentage: 87,
    rain_reading_recorded_at: '2026-10-26T00:00:00Z',
  }), {
    level: 'heavy',
    state: 'raining',
    rain24h: 12.5,
    battery: 87,
    recordedAt: '2026-10-26T00:00:00Z',
    status: 'Saved in Supabase',
  });
});

test('Test Log does not imply successful persistence when no database timestamp exists', () => {
  assert.deepEqual(presentSavedRainReading({
    rain_reading_level: null,
    rain_reading_state: null,
    rain_reading_24h: null,
    rain_reading_battery_percentage: null,
    rain_reading_recorded_at: null,
  }), {
    level: '—',
    state: '—',
    rain24h: null,
    battery: null,
    recordedAt: null,
    status: 'No saved reading',
  });
});
