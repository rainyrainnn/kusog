import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createSimulationClassification,
  getScenarioLabel,
  getStructuralDamageLabel,
  getStructuralDamageStatus,
  getWeatherStatusLabel,
} from './testClassification.ts';

test('new unverified tests use a neutral scenario, not an actual typhoon', () => {
  const classification = createSimulationClassification('Unclassified');
  assert.deepEqual(classification, {
    scenario: 'Unclassified',
    test_mode: 'SIMULATION',
    actual_weather_status: 'UNVERIFIED',
    structural_damage_status: 'NOT_ASSESSED',
  });
  assert.equal(getScenarioLabel(classification.scenario, classification.test_mode), 'Simulated: Unclassified');
  assert.equal(getWeatherStatusLabel(classification.actual_weather_status), 'Unverified');
});

test('a simulated Moderate Typhoon remains explicitly distinct from a verified weather event', () => {
  const classification = createSimulationClassification('Moderate Typhoon');
  assert.equal(getScenarioLabel(classification.scenario, classification.test_mode), 'Simulated: Moderate Typhoon');
  assert.equal(classification.actual_weather_status, 'UNVERIFIED');
});

test('verified weather without damage does not imply an absence of a typhoon', () => {
  assert.equal(getWeatherStatusLabel('VERIFIED_TYPHOON'), 'Verified typhoon');
  assert.equal(getStructuralDamageStatus('PASSED'), 'NOT_DETECTED');
  assert.equal(getStructuralDamageLabel('NOT_DETECTED', 'PASSED'), 'Not detected');
});

test('detected structural damage is stored independently of weather classification', () => {
  assert.equal(getStructuralDamageStatus('DAMAGE DETECTED'), 'DETECTED');
  assert.equal(getStructuralDamageLabel('DETECTED', 'DAMAGE DETECTED'), 'Detected');
  assert.equal(getWeatherStatusLabel('UNVERIFIED'), 'Unverified');
});

test('unavailable physical sensor data does not establish weather or damage classification', () => {
  const classification = createSimulationClassification('Moderate Typhoon');
  assert.equal(classification.actual_weather_status, 'UNVERIFIED');
  assert.equal(classification.structural_damage_status, 'NOT_ASSESSED');
  assert.equal(getWeatherStatusLabel(null), 'Not recorded');
  assert.equal(getStructuralDamageStatus(null), 'NOT_ASSESSED');
});

test('each new run gets fresh classification instead of inheriting the prior scenario or result', () => {
  const prior = createSimulationClassification('Severe Typhoon');
  const next = createSimulationClassification('Unclassified');
  assert.notEqual(next.scenario, prior.scenario);
  assert.equal(next.structural_damage_status, 'NOT_ASSESSED');
  assert.equal(next.actual_weather_status, 'UNVERIFIED');
});

test('deprecated scenario placeholder is normalized before a new record is saved', () => {
  const classification = createSimulationClassification('Custom Scenario');
  assert.equal(classification.scenario, 'Unclassified');
  assert.equal(getScenarioLabel(classification.scenario, classification.test_mode), 'Simulated: Unclassified');
});

test('scenario labels distinguish persisted simulations from records without mode metadata', () => {
  assert.equal(getScenarioLabel('Moderate Typhoon', null), 'Unclassified: Moderate Typhoon');
  assert.equal(getScenarioLabel('Storm observation', 'REAL_WORLD_OBSERVATION'), 'Storm observation');
});

test('legacy placeholder scenarios display as neutral until migration is applied', () => {
  assert.equal(getScenarioLabel('Custom Scenario', 'SIMULATION'), 'Simulated: Unclassified');
});
