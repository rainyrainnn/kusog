export type TestMode = 'SIMULATION' | 'REAL_WORLD_OBSERVATION';
export type ActualWeatherStatus =
  | 'UNVERIFIED'
  | 'VERIFIED_TYPHOON'
  | 'OTHER_WEATHER'
  | 'NORMAL_CONDITIONS';
export type StructuralDamageStatus =
  | 'NOT_ASSESSED'
  | 'INCONCLUSIVE'
  | 'NOT_DETECTED'
  | 'DETECTED';

export function createSimulationClassification(scenario: string) {
  return {
    scenario: scenario === 'Custom Scenario' ? 'Unclassified' : scenario,
    test_mode: 'SIMULATION' as const,
    actual_weather_status: 'UNVERIFIED' as const,
    structural_damage_status: 'NOT_ASSESSED' as const,
  };
}

export function getStructuralDamageStatus(aiOverall: string | null): StructuralDamageStatus {
  if (aiOverall === 'DAMAGE DETECTED') return 'DETECTED';
  return 'NOT_ASSESSED';
}

export function getScenarioLabel(scenario: string | null, mode: TestMode | null): string {
  if (!scenario) return 'Unclassified';
  const displayScenario = scenario === 'Custom Scenario' ? 'Unclassified' : scenario;
  if (mode === 'SIMULATION') return `Simulated: ${displayScenario}`;
  if (mode === 'REAL_WORLD_OBSERVATION') return displayScenario;
  return `Unclassified: ${displayScenario}`;
}

export function getWeatherStatusLabel(status: ActualWeatherStatus | null): string {
  if (status === null) return 'Not recorded';
  switch (status) {
    case 'VERIFIED_TYPHOON': return 'Verified typhoon';
    case 'OTHER_WEATHER': return 'Other weather';
    case 'NORMAL_CONDITIONS': return 'Normal conditions';
    default: return 'Unverified';
  }
}

export function getStructuralDamageLabel(
  status: StructuralDamageStatus | null,
  legacyAiOverall: string | null,
): string {
  switch (status) {
    case 'DETECTED': return 'Detected';
    case 'NOT_DETECTED': return 'Not assessed';
    case 'INCONCLUSIVE': return 'Inconclusive';
    case 'NOT_ASSESSED': return 'Not assessed';
    default: return getStructuralDamageStatus(legacyAiOverall) === 'DETECTED'
      ? 'Detected (legacy AI assessment)'
      : 'Not assessed';
  }
}
