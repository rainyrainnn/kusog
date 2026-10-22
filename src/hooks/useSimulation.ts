import { useCallback, useEffect, useRef, useState } from 'react';
import { finalizeTestRecord, getRunningTestRecord, startTestRecord } from '@/lib/testRecords';
import type { FinalTestPayload, StartTestPayload, TestRecord } from '@/lib/testRecords';
import type { LoadCellData } from '@/lib/loadCell';
import type { WindSensorData } from '@/lib/windSensor';
import { hasDamageClasses, isDamageClassName, type EdgeDetection } from '@/lib/edgeService';
import { updateRunningTestAssessment } from '@/lib/testRecords';


export type LogEntry = {
  id: number;
  time: string;
  message: string;
  level: 'info' | 'warn' | 'ok' | 'error';
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

export function fmtElapsed(secs: number | null | undefined) {
  if (secs === null || secs === undefined || !Number.isFinite(secs)) return '—';
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = secs % 60;
  return `${pad(h)}:${pad(m)}:${pad(s)}`;
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

export function useSimulation({ loadCell, windSensor }: { loadCell: LoadCellData; windSensor: WindSensorData }) {
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

  // Telemetry
  const windSpeed = windSensor.connected ? windSensor.windSpeedMps ?? 0 : 0;
  const windDir = windSensor.connected ? windSensor.windDirectionDeg ?? 0 : 0;
  const [aiConfidence, setAiConfidence] = useState(0);
  const currentForce = loadCell.connected ? loadCell.upliftForceN ?? 0 : 0;

  // AI detections
  const [aiDetections, setAiDetections] = useState({
    roof: '—',
    movement: '—',
    cracks: '—',
    overall: 'NOT ASSESSED',
  });
  const damageDetectedRef = useRef(false);
  const damageClassesRef = useRef<string[]>([]);
  const hasYoloAssessmentRef = useRef(false);

  // Graph data
  const [forceHist, setForceHist] = useState<TelemetryPoint[]>([]);
  const forceTickRef = useRef(0);

  // Logs
  const [logs, setLogs] = useState<LogEntry[]>([
    { id: 1, time: fmtClock(new Date()), message: 'System initialized — KUSOG Control Center v2.4', level: 'info' },
    { id: 2, time: fmtClock(new Date()), message: 'Waiting for live load cell data', level: 'info' },
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
      if (isTestRunning) {
        setElapsed((e) => e + 1);

      } else {
        if (!isTestRunning) setAiConfidence(0);
      }
    }, 1000);
    return () => clearInterval(t);
  }, [isTestRunning]);

  useEffect(() => {
    if (!loadCell.connected || !loadCell.recordedAt) {
      forceTickRef.current = 0;
      setForceHist([]);
      return;
    }

    forceTickRef.current += 1;
    setForceHist((previous) => [
      ...previous.slice(-(HISTORY_LEN - 1)),
      { t: forceTickRef.current, value: loadCell.upliftForceN ?? 0 },
    ]);
  }, [loadCell.connected, loadCell.recordedAt, loadCell.upliftForceN]);

  const [isStarting, setIsStarting] = useState(false);
  const [hasPendingStart, setHasPendingStart] = useState(false);
  const [isFinalizing, setIsFinalizing] = useState(false);
  const [hasPendingFinalization, setHasPendingFinalization] = useState(false);
  const [isRestoring, setIsRestoring] = useState(true);
  const [persistenceError, setPersistenceError] = useState<string | null>(null);
  const [testRecord, setTestRecord] = useState<TestRecord | null>(null);
  const lifecycleLockRef = useRef(false);
  const pendingStartRef = useRef<StartTestPayload | null>(null);
  const pendingFinalizationRef = useRef<{ testId: string; payload: FinalTestPayload } | null>(null);

  // Snapshot current hardware readings so stop always saves the latest available values.
  const snapshotRef = useRef({
    windSpeed: 0, aiConfidence: 0, currentForce: 0,
    aiDetections: { roof: '—', movement: '—', cracks: '—', overall: 'NOT ASSESSED' },
    windDir: 0,
  });

  useEffect(() => {
    snapshotRef.current = {
      windSpeed, aiConfidence, currentForce, aiDetections, windDir,
    };
  }, [windSpeed, aiConfidence, currentForce, aiDetections, windDir]);

  useEffect(() => {
    let active = true;
    getRunningTestRecord().then((record) => {
      if (!active || !record) return;
      const restoredStart = record.start_time ? new Date(record.start_time) : new Date();
      setTestRecord(record);
      setTestId(record.test_id);
      setScenario(record.scenario);
      setStartTime(restoredStart);
      setElapsed(Math.max(0, Math.floor((Date.now() - restoredStart.getTime()) / 1000)));
      damageDetectedRef.current = record.status === 'FAILED' || record.ai_overall === 'DAMAGE DETECTED';
      damageClassesRef.current = record.ai_cracks ? record.ai_cracks.split(', ') : [];
      hasYoloAssessmentRef.current = record.ai_overall === 'PASSED' || damageDetectedRef.current;
      if (hasYoloAssessmentRef.current) {
        setAiDetections({
          roof: '—',
          movement: '—',
          cracks: record.ai_cracks ?? (damageDetectedRef.current ? 'DAMAGE DETECTED' : 'NONE'),
          overall: damageDetectedRef.current ? 'DAMAGE DETECTED' : 'PASSED',
        });
        setAiConfidence(record.ai_confidence ?? 0);
      }
      setHouse({
        modelId: record.house_model_id ?? '',
        modelName: record.house_model_name ?? '',
        modelImageUrl: record.house_model_image_url ?? '',
        wallMaterial: record.wall_material ?? '',
        roofMaterial: record.roof_material ?? '',
        floorMaterial: record.floor_material ?? '',
        otherMaterials: record.other_materials ?? '',
      });
      setIsTestRunning(true);
      addLog(`Resumed active test ${record.test_id} after page reload`, 'warn');
    }).catch((error: unknown) => {
      if (active) setPersistenceError(error instanceof Error ? error.message : 'Unable to check for an unfinished simulation.');
    }).finally(() => {
      if (active) setIsRestoring(false);
    });
    return () => { active = false; };
  }, [addLog]);

  const recordYoloAssessment = useCallback((detections: EdgeDetection[], available: boolean, modelClasses: string[]) => {
    if (!available || !hasDamageClasses(modelClasses)) return;
    hasYoloAssessmentRef.current = true;
    const damageClasses = [...new Set(
      detections
        .map((detection) => detection.className.trim())
        .filter(isDamageClassName),
    )];
    const observedDamageClasses = [...new Set([...damageClassesRef.current, ...damageClasses])];
    const confidence = detections.length
      ? Math.round(Math.max(...detections.map((detection) => detection.confidence)) * 100)
      : 0;
    const hasDamage = damageDetectedRef.current || damageClasses.length > 0;
    setAiConfidence(confidence);
    setAiDetections({
      roof: '—',
      movement: '—',
      cracks: hasDamage ? observedDamageClasses.join(', ') : 'NONE',
      overall: hasDamage ? 'DAMAGE DETECTED' : 'PASSED',
    });

    if (!isTestRunning || !testId || damageClasses.length === 0) return;
    const newlyDetected = damageClasses.filter((className) => !damageClassesRef.current.includes(className));
    if (newlyDetected.length === 0 && damageDetectedRef.current) return;
    damageDetectedRef.current = true;
    damageClassesRef.current = observedDamageClasses;
    addLog(`YOLO damage detected: ${damageClasses.join(', ')}. This test will be marked Failed.`, 'error');
    void updateRunningTestAssessment(testId, {
      ai_confidence: confidence,
      ai_cracks: damageClassesRef.current.join(', '),
      ai_overall: 'DAMAGE DETECTED',
    }).catch((error: unknown) => {
      addLog(`Unable to save the YOLO damage assessment: ${error instanceof Error ? error.message : 'Unknown database error.'}`, 'error');
    });
  }, [addLog, isTestRunning, testId]);

  const startTest = useCallback(async () => {
    if (lifecycleLockRef.current || isTestRunning || isRestoring || pendingFinalizationRef.current) return;
    lifecycleLockRef.current = true;
    setIsStarting(true);
    setPersistenceError(null);
    const start = new Date();
    try {
      if (!pendingStartRef.current) {
        const snap = snapshotRef.current;
        pendingStartRef.current = {
          id: crypto.randomUUID(),
          scenario,
          start_time: start.toISOString(),
          end_time: null,
          duration_seconds: 0,
          status: 'RUNNING',
          house_model_id: house.modelId || null,
          house_model_name: house.modelName || null,
          house_model_image_url: house.modelImageUrl || null,
          wall_material: house.wallMaterial || null,
          roof_material: house.roofMaterial || null,
          floor_material: house.floorMaterial || null,
          other_materials: house.otherMaterials || null,
          wind_speed: windSensor.connected ? snap.windSpeed * 3.6 : null,
          wind_direction: windSensor.connected ? snap.windDir : null,
          current_force: loadCell.connected ? snap.currentForce : null,
          temperature: null,
          humidity: null,
          pressure: null,
          ai_confidence: null,
          ai_roof: null,
          ai_movement: null,
          ai_cracks: null,
          ai_overall: null,
          fan_speed: 0,
          camera_status: 'disconnected',
          camera_stream_url: null,
          log_entries: [],
        };
      }
      const record = await startTestRecord(pendingStartRef.current);
      pendingStartRef.current = null;
      setHasPendingStart(false);
      setTestRecord(record);
      setHasPendingFinalization(false);
      damageDetectedRef.current = false;
      damageClassesRef.current = [];
      hasYoloAssessmentRef.current = false;
      setAiConfidence(0);
      setAiDetections({ roof: '—', movement: '—', cracks: '—', overall: 'NOT ASSESSED' });
      setIsTestRunning(true);
      const actualStart = record.start_time ? new Date(record.start_time) : start;
      setStartTime(actualStart);
      setElapsed(0);
      setTestId(record.test_id);
      forceTickRef.current = 0;
      setForceHist([]);
      addLog(`Simulation started: ${record.scenario} (ID: ${record.test_id})`, 'ok');
      if (house.modelName) addLog(`House model: ${house.modelName}`, 'info');
    } catch (error) {
      setHasPendingStart(true);
      setPersistenceError(error instanceof Error ? error.message : 'Unable to create the simulation record.');
    } finally {
      lifecycleLockRef.current = false;
      setIsStarting(false);
    }
  }, [addLog, house, isRestoring, isTestRunning, loadCell.connected, scenario, windSensor.connected]);

  const finalizePendingTest = useCallback(async () => {
    const pending = pendingFinalizationRef.current;
    if (!pending || lifecycleLockRef.current) return;
    lifecycleLockRef.current = true;
    setIsFinalizing(true);
    setPersistenceError(null);
    try {
      const record = await finalizeTestRecord(pending.testId, pending.payload);
      setTestRecord(record);
      pendingFinalizationRef.current = null;
      setHasPendingFinalization(false);
      addLog(
        `Simulation finalized and saved: ${pending.testId} (${record.status === 'FAILED' ? 'FAILED' : record.ai_overall === 'PASSED' ? 'PASSED' : 'NOT ASSESSED'})`,
        record.status === 'FAILED' ? 'error' : 'ok',
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to save the completed simulation.';
      setPersistenceError(message);
      addLog(`Simulation save failed for ${pending.testId}: ${message}`, 'error');
    } finally {
      lifecycleLockRef.current = false;
      setIsFinalizing(false);
    }
  }, [addLog]);

  const stopTest = useCallback(async () => {
    if (!isTestRunning || lifecycleLockRef.current || !testId || !startTime) return;
    lifecycleLockRef.current = true;
    setIsTestRunning(false);
    const endedAt = new Date();
    const durationSeconds = Math.max(0, Math.floor((endedAt.getTime() - startTime.getTime()) / 1000));
    setElapsed(durationSeconds);
    addLog('Simulation stopped by operator.', 'warn');
    const snap = snapshotRef.current;
    const stoppedLog = { id: logId.current++, time: fmtClock(endedAt), message: 'Simulation stopped by operator.', level: 'warn' as const };
    const payload: FinalTestPayload = {
      end_time: endedAt.toISOString(),
      duration_seconds: durationSeconds,
      status: damageDetectedRef.current ? 'FAILED' : 'COMPLETED',
      wind_speed: windSensor.connected ? snap.windSpeed * 3.6 : null,
      wind_direction: windSensor.connected ? snap.windDir : null,
      current_force: loadCell.connected ? snap.currentForce : null,
      temperature: null,
      humidity: null,
      pressure: null,
      ai_confidence: hasYoloAssessmentRef.current ? snap.aiConfidence : null,
      ai_roof: null,
      ai_movement: null,
      ai_cracks: damageDetectedRef.current
        ? damageClassesRef.current.join(', ')
        : hasYoloAssessmentRef.current ? 'NONE' : null,
      ai_overall: damageDetectedRef.current
        ? 'DAMAGE DETECTED'
        : hasYoloAssessmentRef.current ? 'PASSED' : null,
      fan_speed: 0,
      log_entries: [...logs.slice(-49), stoppedLog],
    };
    pendingFinalizationRef.current = { testId, payload };
    setHasPendingFinalization(true);
    lifecycleLockRef.current = false;
    await finalizePendingTest();
  }, [addLog, isTestRunning, loadCell.connected, logs, startTime, testId, windSensor.connected, finalizePendingTest]);

  const testStatus = isTestRunning
    ? 'RUNNING'
    : isFinalizing
      ? 'FINALIZING'
      : hasPendingFinalization
        ? 'SAVE PENDING'
        : testRecord?.status ?? 'STANDBY';
  const testResult = testRecord?.status === 'FAILED' || damageDetectedRef.current
    ? 'FAILED'
    : testRecord?.status === 'COMPLETED' && testRecord.ai_overall === 'PASSED'
      ? 'PASSED'
      : testRecord?.status === 'RUNNING'
        ? 'IN PROGRESS'
        : testRecord?.status === 'COMPLETED'
          ? 'NOT ASSESSED'
          : '—';

  return {
    now,
    isTestRunning,
    isStarting,
    hasPendingStart,
    isFinalizing,
    hasPendingFinalization,
    isRestoring,
    persistenceError,
    testStatus,
    testResult,
    testRecord,
    testId,
    scenario,
    setScenario,
    startTime,
    elapsed,
    // House selection
    house,
    setHouse,
    // Controls
    windDir,
    // Telemetry
    windSpeed,
    windHist: windSensor.history,
    windSensorConnected: windSensor.connected,
    aiConfidence,
    aiDetections,
    recordYoloAssessment,
    currentForce,
    forceHist,
    loadCellConnected: loadCell.connected,
    // Logs
    logs,
    addLog,
    startTest,
    retryStart: startTest,
    stopTest,
    retryFinalize: finalizePendingTest,
  };
}

export type Simulation = ReturnType<typeof useSimulation>;
