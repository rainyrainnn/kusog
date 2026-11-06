export type SavedRainReading = {
  rain_reading_level: string | null;
  rain_reading_state: string | null;
  rain_reading_24h: number | null;
  rain_reading_battery_percentage: number | null;
  rain_reading_recorded_at: string | null;
};

export function presentSavedRainReading(reading: SavedRainReading) {
  return {
    level: reading.rain_reading_level ?? '—',
    state: reading.rain_reading_state ?? '—',
    rain24h: reading.rain_reading_24h,
    battery: reading.rain_reading_battery_percentage,
    recordedAt: reading.rain_reading_recorded_at,
    status: reading.rain_reading_recorded_at ? 'Saved in Supabase' : 'No saved reading',
  };
}
