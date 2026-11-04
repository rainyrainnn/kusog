export type ParsedRainApiResponse = {
  connected: true;
  rainLevel: string;
  rainState: string;
  rain24h: number | null;
  batteryPercentage: number | null;
} | {
  connected: false;
  error: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function optionalMeasurement(value: unknown, field: string, maximum?: number): number | null {
  if (value === null || value === undefined) return null;
  if (typeof value !== 'number' && typeof value !== 'string') {
    throw new Error(`Rain API returned an invalid ${field} value.`);
  }
  if (typeof value === 'string' && value.trim() === '') {
    throw new Error(`Rain API returned an invalid ${field} value.`);
  }
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0 || (maximum !== undefined && parsed > maximum)) {
    throw new Error(`Rain API returned an invalid ${field} value.`);
  }
  return parsed;
}

export function parseRainApiResponse(value: unknown): ParsedRainApiResponse {
  if (!isRecord(value) || typeof value.connected !== 'boolean') {
    throw new Error('Unexpected response from the rain API.');
  }
  if (!value.connected) {
    return {
      connected: false,
      error: typeof value.error === 'string' && value.error.trim()
        ? value.error
        : 'The Raspberry Pi rain API reports that the sensor is disconnected.',
    };
  }

  const sensor = value.sensor;
  if (!isRecord(sensor)) {
    throw new Error('Rain API reports connected but omitted its sensor object.');
  }
  if (
    (typeof sensor.rain_level !== 'string' && typeof sensor.rain_level !== 'number')
    || String(sensor.rain_level).trim() === ''
    || typeof sensor.rain_state !== 'string'
    || sensor.rain_state.trim() === ''
  ) {
    throw new Error('Rain API reports connected but omitted rain_level or rain_state.');
  }

  return {
    connected: true,
    rainLevel: String(sensor.rain_level),
    rainState: sensor.rain_state,
    rain24h: optionalMeasurement(sensor.rain_24h, 'rain_24h'),
    batteryPercentage: optionalMeasurement(sensor.battery_percentage, 'battery_percentage', 100),
  };
}
