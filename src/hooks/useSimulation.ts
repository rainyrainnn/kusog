import { useCallback, useEffect, useRef, useState } from 'react';
import { saveTestRecord } from '@/lib/testRecords';


export type LogEntry = {
  id: number;
  time: string;
  message: string;
  level: 'info' | 'warn' | 'ok' | 'error';
};

export type RainLevel = 'Light' | 'Moderate' | 'Heavy' | 'Extreme';

export const RAIN_VALUES: Record<RainLevel, number> = {
  Light: 25,
  Moderate: 50,
  Heavy: 70,
  Extreme: 100,
};

export const TEST_SCENARIOS = [
  'Moderate Typhoon',
  'Severe Typhoon',
  'Super Typhoon',
  'Tropical Storm',
  'Custom Scenario',
];

const BEAUFORT = [
  { max: 1,   label: 'Calm' },
  { max: 5,   label: 'Light Air' },
  { max: 11,  label: 'Light Breeze' },
  { max: 19,  label: 'Gentle Breeze' },
  { max: 28,  label: 'Moderate Breeze' },
  { max: 38,  label: 'Fresh Breeze' },
  { max: 49,  label: 'Strong Breeze' },
  { max: 61,  label: 'Near Gale' },
  { max: 74,  label: 'Gale' },
  { max: 88,  label: 'Strong Gale' },
  { max: 102, label: 'Storm' },
  { max: 117, label: 'Violent Storm' },
  { max: 999, label: 'Typhoon Force' },
];

export function windLabel(kmh: number): string {
  if (kmh <= 0) return 'Calm';
  return BEAUFORT.find((b) => kmh <= b.max)?.label ?? 'Typhoon Force';
}

function pad(n: number) {
  return n.toString().padStart(2, '0');
}

export function fmtClock(d: Date) {
  let h = d.getHours();
  const ampm = h >= 12 ? 'PM' : 'AM';
  h = h % 12 || 12;
  return `${pad(h)}:${pad(d.getMinutes())}:${pad(d.getSeconds())} ${ampm}`;
}

export function fmtClock24(d: Date) {
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

export function fmtDate(d: Date) {
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${months[d.getMonth()]} ${pad(d.getDate())}, ${d.getFullYear()}`;
}

export function fmtElapsed(secs: number) {
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = secs % 60;
  return `${pad(h)}:${pad(m)}:${pad(s)}`;
}

let testCounter = 1;
function genTestId(d: Date) {
  const seq = pad(testCounter++);
  return `KUSOG-${d.getFullYear()}-${pad(d.getMonth() + 1)}${pad(d.getDate())}-${seq}`;
}

const HISTORY_LEN = 40;

export type TelemetryPoint = { t: number; value: number };

// House model/material selection carried by the simulation hook so all views share it.
export type HouseSelection = {
  modelId: string;
  modelName: string;
  modelImageUrl: string;
  wallMaterial: string;
  roofMaterial: string;
  floorMaterial: string;
  otherMaterials: string;
};

export const EMPTY_HOUSE: HouseSelection = {
  modelId: '',
  modelName: '',
  modelImageUrl: '',
  wallMaterial: '',
  roofMaterial: '',
  floorMaterial: '',
  otherMaterials: '',
};

export function useSimulation() {
  // Clock
  const [now, setNow] = useState(() => new Date());

  // Test state machine
  const [isTestRunning, setIsTestRunning] = useState(false);
  const [testId, setTestId] = useState<string>('');
  const [scenario, setScenario] = useState(TEST_SCENARIOS[0]);
  const [startTime, setStartTime] = useState<Date | null>(null);
  const [elapsed, setElapsed] = useState(0);

  // House model / material selection (set before test start)
  const [house, setHouse] = useState<HouseSelection>(EMPTY_HOUSE);

  // Controls
  const [fanSpeed, setFanSpeed] = useState(0);
  const [rainLevel, setRainLevel] = useState<RainLevel>('Light');
  const [windDir, setWindDir] = useState(45);

  // Telemetry
  const [windSpeed, setWindSpeed] = useState(0);
  const [temperature, setTemperature] = useState(26.5);
  const [humidity, setHumidity] = useState(55);
  const [pressure, setPressure] = useState(1013);
  const [aiConfidence, setAiConfidence] = useState(0);
  const [currentForce, setCurrentForce] = useState(0);

  // AI detections
  const [aiDetections, setAiDetections] = useState({
    roof: 'NORMAL',
    movement: 'NORMAL',
    cracks: 'NONE',
    overall: 'STANDBY',
  });

  // Graph data
  const [forceHist, setForceHist] = useState<TelemetryPoint[]>([]);
  const tickRef = useRef(0);

  // Logs
  const [logs, setLogs] = useState<LogEntry[]>([
    { id: 1, time: fmtClock(new Date()), message: 'System initialized — KUSOG Control Center v2.4', level: 'info' },
    { id: 2, time: fmtClock(new Date()), message: 'Load Cell sensor calibrated — ready', level: 'ok' },
    { id: 3, time: fmtClock(new Date()), message: 'AI model loaded — structural analysis ready', level: 'ok' },
    { id: 4, time: fmtClock(new Date()), message: 'Awaiting test initialization', level: 'info' },
  ]);
  const logId = useRef(100);

  const addLog = useCallback((message: string, level: LogEntry['level'] = 'info') => {
    setLogs((prev) => [...prev.slice(-200), { id: logId.current++, time: fmtClock(new Date()), message, level }]);
  }, []);

  // Clock tick — every second
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  // Main telemetry tick
  useEffect(() => {
    const t = setInterval(() => {
      tickRef.current += 1;
      const tick = tickRef.current;

      if (isTestRunning) {
        setElapsed((e) => e + 1);

        setWindSpeed((w) => {
          const target = (fanSpeed / 100) * 120 + (Math.random() - 0.5) * 3;
          return Math.max(0, +(w + (target - w) * 0.2).toFixed(1));
        });

        setTemperature((t) => +(t + (Math.random() - 0.5) * 0.06).toFixed(1));
        setHumidity((h) => {
          const target = 55 + (RAIN_VALUES[rainLevel] / 100) * 35;
          return Math.max(0, Math.min(100, +(h + (target - h) * 0.08 + (Math.random() - 0.5) * 0.4).toFixed(1)));
        });
        setPressure((p) => {
          const target = 1013 - (fanSpeed / 100) * 18 - (RAIN_VALUES[rainLevel] / 100) * 5;
          return Math.round(p + (target - p) * 0.1 + (Math.random() - 0.5) * 0.5);
        });

        setAiConfidence((c) => Math.max(85, Math.min(99, c + Math.round((Math.random() - 0.5) * 1.2))));

        // Force
        const fVal = Math.max(0, +(15 + (fanSpeed / 100) * 28 + (RAIN_VALUES[rainLevel] / 100) * 6 + (Math.random() - 0.5) * 4).toFixed(1));
        setForceHist((prev) => [...prev.slice(-(HISTORY_LEN - 1)), { t: tick, value: fVal }]);
        setCurrentForce(fVal);
      } else {
        const fVal = +(Math.random() * 0.2).toFixed(1);
        setForceHist((prev) => [...prev.slice(-(HISTORY_LEN - 1)), { t: tick, value: fVal }]);
        setWindSpeed(0);
        setAiConfidence(0);
        setCurrentForce(0);
      }
    }, 1000);
    return () => clearInterval(t);
  }, [isTestRunning, fanSpeed, rainLevel]);

  // AI detections react to telemetry
  useEffect(() => {
    if (!isTestRunning) {
      setAiDetections({ roof: 'NORMAL', movement: 'NORMAL', cracks: 'NONE', overall: 'STANDBY' });
      return;
    }
    const stress = (windSpeed / 120) * 0.6 + (RAIN_VALUES[rainLevel] / 100) * 0.4;
    setAiDetections({
      roof:     stress > 0.85 ? 'DETECTED' : 'NORMAL',
      movement: stress > 0.7  ? 'WARNING'  : 'NORMAL',
      cracks:   stress > 0.9  ? 'DETECTED' : 'NONE',
      overall:  stress > 0.85 ? 'CRITICAL' : 'SAFE',
    });
  }, [isTestRunning, windSpeed, rainLevel]);

  // Snapshot of key values for saving — captured via refs so stopTest closure is stable
  const snapshotRef = useRef({
    windSpeed: 0, temperature: 26.5, humidity: 55, pressure: 1013,
    aiConfidence: 0, currentForce: 0, aiDetections: { roof: 'NORMAL', movement: 'NORMAL', cracks: 'NONE', overall: 'STANDBY' },
    fanSpeed: 0, rainLevel: 'Light' as RainLevel, windDir: 45,
  });

  useEffect(() => {
    snapshotRef.current = { windSpeed, temperature, humidity, pressure, aiConfidence, currentForce, aiDetections, fanSpeed, rainLevel, windDir };
  }, [windSpeed, temperature, humidity, pressure, aiConfidence, currentForce, aiDetections, fanSpeed, rainLevel, windDir]);

  const startTest = useCallback(() => {
    const start = new Date();
    const id = genTestId(start);
    setIsTestRunning(true);
    setStartTime(start);
    setElapsed(0);
    setTestId(id);
    setFanSpeed(60);
    setRainLevel('Heavy');
    setWindDir(45);
    tickRef.current = 0;
    setForceHist([]);
    addLog(`Test started: ${scenario} (ID: ${id})`, 'ok');
    addLog(`Fan speed initialized to 60%`, 'info');
    addLog(`Rain intensity initialized to Heavy (70%)`, 'info');
    addLog(`Wind direction initialized to NE (45°)`, 'info');
    if (house.modelName) addLog(`House model: ${house.modelName}`, 'info');
  }, [scenario, addLog, house.modelName]);

  const stopTest = useCallback(() => {
    setIsTestRunning(false);
    const endTime = new Date();
    addLog('Test stopped by operator — Emergency halt', 'error');
    addLog(`Test halted at ${fmtElapsed(elapsed)}`, 'warn');

    // Capture stable snapshot values
    const snap = snapshotRef.current;

    // Save to Supabase (fire-and-forget, errors logged but do not block UI)
    setLogs((currentLogs) => {
      const payload = {
        test_id: testId || `KUSOG-${Date.now()}`,
        scenario,
        start_time: startTime?.toISOString() ?? null,
        end_time: endTime.toISOString(),
        duration_seconds: elapsed,
        status: 'COMPLETED',
        house_model_id: null as string | null,
        house_model_name: house.modelName || null,
        house_model_image_url: house.modelImageUrl || null,
        wall_material: house.wallMaterial || null,
        roof_material: house.roofMaterial || null,
        floor_material: house.floorMaterial || null,
        other_materials: house.otherMaterials || null,
        wind_speed: snap.windSpeed,
        temperature: snap.temperature,
        humidity: snap.humidity,
        pressure: snap.pressure,
        current_force: snap.currentForce,
        ai_confidence: snap.aiConfidence,
        ai_roof: snap.aiDetections.roof,
        ai_movement: snap.aiDetections.movement,
        ai_cracks: snap.aiDetections.cracks,
        ai_overall: snap.aiDetections.overall,
        fan_speed: snap.fanSpeed,
        rain_level: snap.rainLevel,
        wind_direction: snap.windDir,
        camera_status: 'disconnected',
camera_stream_url: null,
        log_entries: currentLogs.slice(-50),
      };
      saveTestRecord(payload).then(({ error }) => {
        if (error) console.warn('[KUSOG] Failed to save test record:', error.message);
      });
      return currentLogs;
    });
  }, [addLog, elapsed, testId, scenario, startTime, house]);

  const adjustFan = useCallback((delta: number) => {
    setFanSpeed((v) => Math.max(0, Math.min(100, v + delta)));
  }, []);

  const setFanSpeedLogged = useCallback((v: number) => {
    setFanSpeed(Math.max(0, Math.min(100, v)));
  }, []);

  const setRainLogged = useCallback((lvl: RainLevel) => {
    setRainLevel(lvl);
  }, []);

  const applyControls = useCallback(() => {
    addLog(`Controls applied — Fan ${fanSpeed}%, Rain ${rainLevel} (${RAIN_VALUES[rainLevel]}%)`, 'ok');
  }, [addLog, fanSpeed, rainLevel]);

  const setWindDirLogged = useCallback((deg: number) => {
    setWindDir(((deg % 360) + 360) % 360);
  }, []);

  const logWindDirection = useCallback((deg: number) => {
    const cardinals = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
    const idx = Math.round(deg / 45) % 8;
    addLog(`Wind direction set to ${cardinals[idx]} (${Math.round(deg)}°)`, 'info');
  }, [addLog]);

  return {
    now,
    isTestRunning,
    testId,
    scenario,
    setScenario,
    startTime,
    elapsed,
    // House selection
    house,
    setHouse,
    // Controls
    fanSpeed,
    setFanSpeed: setFanSpeedLogged,
    adjustFan,
    rainLevel,
    setRainLevel: setRainLogged,
    rainValue: RAIN_VALUES[rainLevel],
    windDir,
    setWindDir: setWindDirLogged,
    logWindDirection,
    // Telemetry
    windSpeed,
    temperature,
    humidity,
    pressure,
    aiConfidence,
    aiDetections,
    currentForce,
    forceHist,
    // Logs
    logs,
    addLog,
    applyControls,
    startTest,
    stopTest,
  };
}

export type Simulation = ReturnType<typeof useSimulation>;
