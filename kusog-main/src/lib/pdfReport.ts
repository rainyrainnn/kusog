import jsPDF from 'jspdf';
import autoTable, { type Table } from 'jspdf-autotable';
import type { TestRecordWithSensorSummary } from './testRecords';
import { getScenarioLabel, getStructuralDamageLabel, getWeatherStatusLabel } from './testClassification';

const PAGE_WIDTH = 210;
const PAGE_HEIGHT = 297;
const LEFT = 14;
const RIGHT = 14;
const CONTENT_WIDTH = PAGE_WIDTH - LEFT - RIGHT;
const HEADER_BG: [number, number, number] = [8, 24, 42];
const PRIMARY: [number, number, number] = [14, 116, 164];
const TEXT: [number, number, number] = [35, 48, 62];
const MUTED: [number, number, number] = [100, 116, 139];

function missing(value: string | null | undefined): string {
  return value?.trim() || '--';
}

function dateTime(value: string | null): string {
  if (!value) return '--';
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? '--' : parsed.toLocaleString();
}

function duration(seconds: number | null): string {
  if (seconds === null || !Number.isFinite(seconds)) return '--';
  const total = Math.max(0, Math.floor(seconds));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const remaining = total % 60;
  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${remaining.toString().padStart(2, '0')}`;
}

function resultLabel(record: TestRecordWithSensorSummary): string {
  if (record.status === 'FAILED') return 'FAILED';
  if (record.status === 'RUNNING') return 'RUNNING';
  if (record.status === 'COMPLETED') return 'COMPLETED';
  return missing(record.status);
}

function sectionTitle(doc: jsPDF, title: string, y: number): number {
  const pageHeight = doc.internal.pageSize.getHeight();
  if (y + 22 > pageHeight - 22) {
    doc.addPage();
    y = 22;
  }
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(...PRIMARY);
  doc.text(title.toUpperCase(), LEFT, y);
  doc.setDrawColor(206, 220, 230);
  doc.setLineWidth(0.35);
  doc.line(LEFT, y + 2, PAGE_WIDTH - RIGHT, y + 2);
  return y + 7;
}

function tableEndY(doc: jsPDF, fallback: number): number {
  const tableDoc = doc as jsPDF & { lastAutoTable?: Table };
  return tableDoc.lastAutoTable?.finalY ?? fallback;
}

function addTable(doc: jsPDF, y: number, head: string[][], body: string[][], color: [number, number, number]): number {
  autoTable(doc, {
    startY: y,
    margin: { left: LEFT, right: RIGHT, top: 20, bottom: 20 },
    head,
    body,
    theme: 'striped',
    headStyles: { fillColor: color, textColor: [255, 255, 255], fontSize: 8, fontStyle: 'bold', cellPadding: 2.5 },
    bodyStyles: { textColor: TEXT, fontSize: 8.5, cellPadding: 2.5, overflow: 'linebreak', valign: 'top' },
    alternateRowStyles: { fillColor: [245, 248, 250] },
    styles: { overflow: 'linebreak', cellWidth: 'wrap' },
    rowPageBreak: 'avoid',
    pageBreak: 'auto',
    tableWidth: CONTENT_WIDTH,
  });
  return tableEndY(doc, y) + 10;
}

function drawPageChrome(doc: jsPDF, generatedAt: Date) {
  const pages = doc.getNumberOfPages();
  const generated = Number.isNaN(generatedAt.getTime()) ? '--' : generatedAt.toLocaleString();
  for (let page = 1; page <= pages; page += 1) {
    doc.setPage(page);
    if (page > 1) {
      doc.setFillColor(...HEADER_BG);
      doc.rect(0, 0, PAGE_WIDTH, 13, 'F');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.setTextColor(125, 211, 252);
      doc.text('KUSOG', LEFT, 8.5);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(226, 232, 240);
      doc.text('Test Report', LEFT + 22, 8.5);
    }

    doc.setDrawColor(220, 228, 235);
    doc.line(LEFT, PAGE_HEIGHT - 15, PAGE_WIDTH - RIGHT, PAGE_HEIGHT - 15);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(...MUTED);
    doc.text(`Generated ${generated}`, LEFT, PAGE_HEIGHT - 9);
    doc.text(`Page ${page} of ${pages}`, PAGE_WIDTH - RIGHT, PAGE_HEIGHT - 9, { align: 'right' });
  }
}

export async function generatePdf(record: TestRecordWithSensorSummary, generatedAt: Date): Promise<void> {
  const doc = new jsPDF({ format: 'a4', unit: 'mm', compress: true });

  doc.setFillColor(...HEADER_BG);
  doc.rect(0, 0, PAGE_WIDTH, 38, 'F');
  doc.setFillColor(14, 165, 233);
  doc.rect(LEFT, 10, 2, 18, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(22);
  doc.setTextColor(125, 211, 252);
  doc.text('KUSOG', LEFT + 7, 18);
  doc.setFontSize(12);
  doc.setTextColor(255, 255, 255);
  doc.text('TEST REPORT', LEFT + 7, 26);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(203, 213, 225);
  doc.text('Smart Typhoon Simulation Chamber', LEFT + 7, 32);
  doc.text(`Report generated: ${Number.isNaN(generatedAt.getTime()) ? '--' : generatedAt.toLocaleString()}`, PAGE_WIDTH - RIGHT, 17, { align: 'right' });
  doc.text(`Record: ${missing(record.test_id)}`, PAGE_WIDTH - RIGHT, 24, { align: 'right' });

  let y = 48;
  y = sectionTitle(doc, 'Test summary', y);
  y = addTable(doc, y, [['Field', 'Saved value']], [
    ['Test ID', missing(record.test_id)],
    ['Operator ID', missing(record.operator_id)],
    ['Scenario', getScenarioLabel(record.scenario, record.test_mode)],
    ['Test mode', missing(record.test_mode)],
    ['Record status', resultLabel(record)],
    ['Result', record.status === 'FAILED' ? 'FAILED' : record.status === 'RUNNING' ? 'IN PROGRESS' : 'NOT ASSESSED'],
    ['Started', dateTime(record.start_time)],
    ['Ended', dateTime(record.end_time)],
    ['Duration', duration(record.duration_seconds)],
  ], PRIMARY);

  y = sectionTitle(doc, 'Saved sensor readings', y);
  y = addTable(doc, y, [['Sensor / parameter', 'Reading', 'Unit', 'Source / note']], [
    ['Wind speed', record.wind_speed_kmh === null ? '--' : record.wind_speed_kmh.toFixed(2), 'km/h', 'Latest associated saved wind reading'],
    ['Wind direction', record.wind_direction_degrees === null ? '--' : `${record.wind_direction_degrees.toFixed(1)}`, 'degrees', 'Latest associated saved wind reading'],
    ['Uplift force', record.uplift_force_n === null ? '--' : record.uplift_force_n.toFixed(2), 'N', 'Latest associated saved load-cell reading'],
    ['BMP280 temperature', record.bmp280_temperature_c === null ? '--' : record.bmp280_temperature_c.toFixed(1), '°C', 'Latest associated saved BMP280 reading'],
    ['BMP280 atmospheric pressure', record.bmp280_pressure_hpa === null ? '--' : record.bmp280_pressure_hpa.toFixed(1), 'hPa', 'Latest associated saved BMP280 reading'],
    ['BMP280 reading timestamp', dateTime(record.bmp280_reading_recorded_at), '--', 'Database-recorded BMP280 timestamp'],
    ['Rain level', missing(record.rain_reading_level ?? record.rain_level_raw ?? record.rain_level), '--', 'Saved test-record rain reading'],
    ['Rain state', missing(record.rain_reading_state ?? record.rain_state), '--', 'Saved test-record rain reading'],
    ['Rainfall (24 h)', record.rain_reading_24h === null ? '--' : String(record.rain_reading_24h), 'API unit', 'Saved test-record rain reading'],
    ['Rain reading timestamp', dateTime(record.rain_reading_recorded_at ?? record.rain_sensor_reading_recorded_at ?? null), '--', 'Database-recorded timestamp'],
    ['Rain battery', record.rain_reading_battery_percentage !== null && record.rain_reading_battery_percentage !== undefined
      ? `${record.rain_reading_battery_percentage}`
      : record.rain_battery !== null && record.rain_battery !== undefined ? `${record.rain_battery}` : '--', '%', 'Saved test-record rain reading'],
  ], [34, 139, 92]);

  const hasSavedAi = record.ai_cracks !== null
    || record.ai_confidence !== null
    || record.ai_roof !== null
    || record.ai_movement !== null;
  y = sectionTitle(doc, 'AI results', y);
  const aiRows = hasSavedAi
    ? [
        ['Saved detection labels / notes', missing(record.ai_cracks)],
        ['Saved confidence', record.ai_confidence === null ? '--' : `${record.ai_confidence}%`],
        ['Other saved AI fields', [record.ai_roof, record.ai_movement].filter(Boolean).join(' · ') || '--'],
      ]
    : [['Saved object-detection details', '--'], ['Saved confidence', '--']];
  aiRows.push([
    'Structural damage assessment',
    getStructuralDamageLabel(record.structural_damage_status, record.ai_overall),
  ]);
  y = addTable(doc, y, [['Category', 'Saved value']], aiRows, [109, 78, 151]);

  y = sectionTitle(doc, 'Additional saved test details', y);
  const details = [
    ['House model', missing(record.house_model_name)],
    ['Wall material', missing(record.wall_material)],
    ['Roof material', missing(record.roof_material)],
    ['Floor material', missing(record.floor_material)],
    ['Other materials', missing(record.other_materials)],
    ['Actual weather status', getWeatherStatusLabel(record.actual_weather_status)],
    ['Camera status', missing(record.camera_status)],
  ];
  addTable(doc, y, [['Field', 'Saved value']], details, [71, 85, 105]);

  drawPageChrome(doc, generatedAt);
  const filename = `${(record.test_id || 'KUSOG_test').replace(/[<>:"/\\|?*]/g, '_')}_report.pdf`;
  doc.save(filename);
}
