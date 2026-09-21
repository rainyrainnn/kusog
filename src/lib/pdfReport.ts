/*
 * Shared PDF report generator — used by ReportGeneration panel and ReportsView.
 * All jsPDF + autoTable logic lives here so it is not duplicated.
 *
 * Data source: TestRecord (from Supabase) or a live simulation snapshot.
 * House model images are fetched from the stored image_url if available.
 */

import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { fmtDate, fmtClock, fmtElapsed } from '@/hooks/useSimulation';
import type { TestRecord } from './testRecords';

const CLR_HEADER_BG: [number, number, number] = [11, 15, 25];
const CLR_PRIMARY:   [number, number, number] = [14, 165, 233];
const CLR_OK:        [number, number, number] = [34, 197, 94];
const CLR_PURPLE:    [number, number, number] = [168, 85, 247];
const CLR_AMBER:     [number, number, number] = [251, 191, 36];
const CLR_SLATE:     [number, number, number] = [100, 116, 139];
const CLR_ORANGE:    [number, number, number] = [249, 115, 22];
const CLR_TXT:       [number, number, number] = [50, 50, 50];

function headStyle(fill: [number, number, number]) {
  return { fillColor: fill, textColor: [255, 255, 255] as [number,number,number], fontSize: 10, fontStyle: 'bold' as const };
}
const bodyStyle = { textColor: CLR_TXT, fontSize: 10 };
const cellStyle = { cellPadding: 3 };

function sectionTitle(doc: jsPDF, text: string, y: number, num: string) {
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(14, 165, 233);
  doc.text(`${num}. ${text.toUpperCase()}`, 14, y);
  doc.setDrawColor(14, 165, 233);
  doc.setLineWidth(0.4);
  doc.line(14, y + 1.5, 196, y + 1.5);
  doc.setTextColor(50, 50, 50);
  return y + 8;
}

function getY(doc: jsPDF): number {
  return (doc as any).lastAutoTable?.finalY ?? 0;
}

function ensurePage(doc: jsPDF, needed = 40): number {
  const y = getY(doc);
  if (y + needed > 270) {
    doc.addPage();
    return 20;
  }
  return y + 8;
}

async function loadImageAsDataUrl(url: string): Promise<string | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const blob = await res.blob();
    return await new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

export async function generatePdf(record: TestRecord, generatedAt: Date): Promise<void> {
  const doc = new jsPDF();

  // ── Cover header ──────────────────────────────────────────────────────────
  doc.setFillColor(...CLR_HEADER_BG);
  doc.rect(0, 0, 210, 30, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(20);
  doc.setTextColor(56, 189, 248);
  doc.text('KUSOG', 14, 14);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(226, 232, 240);
  doc.text('Smart Typhoon Simulation Chamber — Test Report', 14, 21);

  doc.setTextColor(120, 130, 145);
  doc.setFontSize(8);
  doc.text(`Generated: ${fmtDate(generatedAt)} ${fmtClock(generatedAt)}`, 120, 13);
  doc.text('KUSOG Control Center v2.4 · Thesis Project', 120, 19);
  doc.text(`Report ID: ${record.test_id}`, 120, 25);

  // ── 1. TEST INFORMATION ───────────────────────────────────────────────────
  let y = sectionTitle(doc, 'Test Information', 40, '1');

  autoTable(doc, {
    startY: y,
    head: [['Field', 'Value']],
    body: [
      ['Test ID',    record.test_id],
      ['Scenario',   record.scenario],
      ['Status',     record.status],
      ['Start Time', record.start_time ? fmtClock(new Date(record.start_time)) : '—'],
      ['End Time',   record.end_time   ? fmtClock(new Date(record.end_time))   : '—'],
      ['Duration',   fmtElapsed(record.duration_seconds)],
    ],
    theme: 'striped',
    headStyles: headStyle(CLR_PRIMARY),
    bodyStyles: bodyStyle,
    styles: cellStyle,
  });

  // ── 2. HOUSE MODEL AND MATERIALS ──────────────────────────────────────────
  y = ensurePage(doc, 80);
  y = sectionTitle(doc, 'House Model and Materials', y, '2');

  // Try to load house model image
  let imgDataUrl: string | null = null;
  if (record.house_model_image_url) {
    imgDataUrl = await loadImageAsDataUrl(record.house_model_image_url);
  }

  const hasHouseInfo = record.house_model_name || record.wall_material || record.roof_material || record.floor_material;

  autoTable(doc, {
    startY: y,
    head: [['Field', 'Value']],
    body: [
      ['House Model',     record.house_model_name  || 'Not specified'],
      ['Wall Material',   record.wall_material      || 'Not specified'],
      ['Roof Material',   record.roof_material      || 'Not specified'],
      ['Floor Material',  record.floor_material     || 'Not specified'],
      ['Other Materials', record.other_materials    || '—'],
    ],
    theme: 'striped',
    headStyles: headStyle(CLR_ORANGE),
    bodyStyles: bodyStyle,
    styles: cellStyle,
  });

  // Insert house image if available
  if (imgDataUrl) {
    const imgY = ensurePage(doc, 80);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(100, 116, 139);
    doc.text('House Model Photo:', 14, imgY);

    const maxW = 120;
    const maxH = 70;
    // Draw at reasonable size, capped to page width
    try {
      doc.addImage(imgDataUrl, 'JPEG', 14, imgY + 4, maxW, maxH, undefined, 'MEDIUM');
      // Move lastAutoTable.finalY manually since addImage doesn't update it
      (doc as any).lastAutoTable = { finalY: imgY + 4 + maxH };
    } catch {
      // Image failed; continue without it
    }
  } else if (record.house_model_image_url) {
    const noImgY = getY(doc) + 6;
    doc.setFontSize(9);
    doc.setTextColor(100, 116, 139);
    doc.text('[House model image could not be loaded]', 14, noImgY);
    (doc as any).lastAutoTable = { finalY: noImgY };
  }

  // ── 3. SENSOR RESULTS ─────────────────────────────────────────────────────
  y = ensurePage(doc, 60);
  y = sectionTitle(doc, 'Sensor Results', y, '3');

  autoTable(doc, {
    startY: y,
    head: [['Sensor / Parameter', 'Reading', 'Unit']],
    body: [
      ['Wind Speed',       record.wind_speed?.toFixed(1)     ?? '—', 'km/h'],
      ['Temperature',      record.temperature?.toFixed(1)    ?? '—', '°C'],
      ['Humidity',         record.humidity?.toFixed(1)       ?? '—', '%'],
      ['Air Pressure',     String(record.pressure ?? '—'),           'hPa'],
      ['Base Uplift Force',record.current_force?.toFixed(1)  ?? '—', 'N'],
    ],
    theme: 'striped',
    headStyles: headStyle(CLR_OK),
    bodyStyles: bodyStyle,
    styles: cellStyle,
  });

  // ── 4. AI STRUCTURAL ASSESSMENT ───────────────────────────────────────────
  y = ensurePage(doc, 60);
  y = sectionTitle(doc, 'AI Structural Assessment', y, '4');

  autoTable(doc, {
    startY: y,
    head: [['Detection', 'Status']],
    body: [
      ['Roof Displacement',    record.ai_roof      ?? '—'],
      ['Structural Movement',  record.ai_movement  ?? '—'],
      ['Visible Cracks',       record.ai_cracks    ?? '—'],
      ['Overall Condition',    record.ai_overall   ?? '—'],
      ['AI Confidence',        `${record.ai_confidence ?? '—'}%`],
    ],
    theme: 'striped',
    headStyles: headStyle(CLR_PURPLE),
    bodyStyles: bodyStyle,
    styles: cellStyle,
  });

  // ── 5. CAMERA INFORMATION ─────────────────────────────────────────────────
  y = ensurePage(doc, 40);
  y = sectionTitle(doc, 'Camera Information', y, '5');

  autoTable(doc, {
    startY: y,
    head: [['Field', 'Value']],
    body: [
      ['Camera Status', record.camera_status ?? 'disconnected'],
      ['Stream URL',    record.camera_stream_url ?? 'Not configured'],
    ],
    theme: 'striped',
    headStyles: headStyle(CLR_SLATE),
    bodyStyles: bodyStyle,
    styles: cellStyle,
  });

  // ── 6. CONTROL SETTINGS ───────────────────────────────────────────────────
  y = ensurePage(doc, 40);
  y = sectionTitle(doc, 'Control Settings', y, '6');

  autoTable(doc, {
    startY: y,
    head: [['Control', 'Value']],
    body: [
      ['Fan Speed',       `${record.fan_speed ?? '—'}%`],
      ['Rain Intensity',  record.rain_level ?? '—'],
      ['Wind Direction',  `${record.wind_direction ?? '—'}°`],
    ],
    theme: 'striped',
    headStyles: headStyle(CLR_AMBER),
    bodyStyles: bodyStyle,
    styles: cellStyle,
  });

  // ── 7. RECENT LOG ENTRIES ─────────────────────────────────────────────────
  const logEntries = (record.log_entries ?? []) as Array<{ time: string; message: string }>;
  if (logEntries.length > 0) {
    y = ensurePage(doc, 40);
    y = sectionTitle(doc, 'Recent Log Entries', y, '7');

    autoTable(doc, {
      startY: y,
      head: [['Time', 'Event']],
      body: logEntries.slice(-10).map((l) => [l.time, l.message]),
      theme: 'striped',
      headStyles: headStyle(CLR_SLATE),
      bodyStyles: { ...bodyStyle, fontSize: 9 },
      styles: cellStyle,
    });
  }

  // ── Footer on every page ──────────────────────────────────────────────────
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(120, 130, 145);
    doc.setFont('helvetica', 'normal');
    doc.text('KUSOG Control Center v2.4 · Thesis Project', 14, 290);
    doc.text(`Page ${i} of ${pageCount}`, 170, 290);
  }

  doc.save(`${record.test_id}_report.pdf`);
}
