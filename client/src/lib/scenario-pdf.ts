import { jsPDF } from "jspdf";

/**
 * Shared, client-side PDF generation for the five scenario detail
 * views (Purchase with Loan, Purchase with Cash, Refinance,
 * Insurance, Sell Your Home).
 *
 * The PDF is intentionally a clean text-based summary built from the
 * data already rendered on the page — no DOM capture, no server call.
 * `jsPDF.save()` produces a Blob and triggers a normal download, which
 * works on mobile browsers (the user can then open/share it from their
 * device).
 */

export type ScenarioPdfType =
  | "purchase"
  | "cash_buy"
  | "refinance"
  | "insurance"
  | "seller";

export interface ScenarioPdfRow {
  label: string;
  value: string;
}

export interface ScenarioPdfSection {
  /** Optional section heading rendered above the rows. */
  heading?: string;
  rows: ScenarioPdfRow[];
}

/** Everything a page supplies to render its PDF (minus scenarioType,
 *  which ScenarioActions already knows). */
export interface ScenarioPdfContent {
  address: string;
  sections: ScenarioPdfSection[];
  /** Optional status / market message (e.g. seller Draft/Ready/List). */
  statusNote?: string;
  /** Scenario-specific assumptions / legal disclaimer. */
  disclaimer?: string;
}

export interface ScenarioPdfInput extends ScenarioPdfContent {
  scenarioType: ScenarioPdfType;
}

const TITLE: Record<ScenarioPdfType, string> = {
  purchase: "Purchase with Loan",
  cash_buy: "Purchase with Cash",
  refinance: "Refinance",
  insurance: "Insurance",
  seller: "Sell Your Home",
};

const FILE_PREFIX: Record<ScenarioPdfType, string> = {
  purchase: "purchase-with-loan",
  cash_buy: "purchase-with-cash",
  refinance: "refinance",
  insurance: "insurance",
  seller: "sell-your-home",
};

const BRAND = "Havo";

function slugify(s: string): string {
  return (s || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

/** Build the download filename, e.g. purchase-with-loan-4311-63rd-way-n.pdf */
export function buildScenarioFileName(
  scenarioType: ScenarioPdfType,
  address: string,
): string {
  const addrSlug = slugify(address);
  return addrSlug
    ? `${FILE_PREFIX[scenarioType]}-${addrSlug}.pdf`
    : `${FILE_PREFIX[scenarioType]}.pdf`;
}

/** Generate and download a clean text PDF summary of a scenario. */
export function downloadScenarioPdf(input: ScenarioPdfInput): void {
  const { scenarioType, address, sections, statusNote, disclaimer } = input;

  const doc = new jsPDF({ unit: "pt", format: "letter" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 48;
  const contentWidth = pageWidth - margin * 2;
  const labelWidth = contentWidth * 0.62;
  const valueX = margin + labelWidth;

  let y = margin;

  const ensureSpace = (needed: number) => {
    if (y + needed > pageHeight - margin) {
      doc.addPage();
      y = margin;
    }
  };

  // Brand header
  doc.setFont("helvetica", "bold");
  doc.setFontSize(20);
  doc.setTextColor(20, 20, 20);
  doc.text(BRAND, margin, y);
  y += 22;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.setTextColor(60, 60, 60);
  doc.text(`${TITLE[scenarioType]} Summary`, margin, y);
  y += 18;

  // Address + date
  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  doc.setTextColor(40, 40, 40);
  if (address) {
    const addrLines = doc.splitTextToSize(address, contentWidth);
    addrLines.forEach((line: string) => {
      ensureSpace(15);
      doc.text(line, margin, y);
      y += 15;
    });
  }
  const dateStr = new Date().toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  doc.setTextColor(110, 110, 110);
  doc.text(`Generated ${dateStr}`, margin, y);
  y += 10;

  // Divider
  doc.setDrawColor(220, 220, 220);
  doc.line(margin, y, pageWidth - margin, y);
  y += 18;

  // Sections
  doc.setFontSize(11);
  sections.forEach((section) => {
    if (section.rows.length === 0) return;
    if (section.heading) {
      ensureSpace(22);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(12);
      doc.setTextColor(30, 30, 30);
      doc.text(section.heading, margin, y);
      y += 16;
      doc.setFontSize(11);
    }
    section.rows.forEach((row) => {
      ensureSpace(16);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(70, 70, 70);
      const labelLines = doc.splitTextToSize(row.label, labelWidth - 8);
      doc.text(labelLines, margin, y);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(20, 20, 20);
      const valueLines = doc.splitTextToSize(row.value || "—", contentWidth - labelWidth);
      doc.text(valueLines, valueX, y);
      const rowHeight = Math.max(labelLines.length, valueLines.length) * 14;
      y += rowHeight + 4;
    });
    y += 8;
  });

  // Status note
  if (statusNote) {
    ensureSpace(40);
    y += 4;
    doc.setFont("helvetica", "italic");
    doc.setFontSize(10);
    doc.setTextColor(90, 90, 90);
    const noteLines = doc.splitTextToSize(statusNote, contentWidth);
    noteLines.forEach((line: string) => {
      ensureSpace(14);
      doc.text(line, margin, y);
      y += 14;
    });
    y += 6;
  }

  // Disclaimer
  if (disclaimer) {
    ensureSpace(30);
    y += 6;
    doc.setDrawColor(220, 220, 220);
    doc.line(margin, y, pageWidth - margin, y);
    y += 14;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(120, 120, 120);
    const discLines = doc.splitTextToSize(disclaimer, contentWidth);
    discLines.forEach((line: string) => {
      ensureSpace(11);
      doc.text(line, margin, y);
      y += 11;
    });
  }

  doc.save(buildScenarioFileName(scenarioType, address));
}
