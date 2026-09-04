import { jsPDF } from "jspdf";
import type { FeeLine, FeeSection, FeeWorksheet } from "./fee-worksheet";
import type { PurchaseLenderInfo } from "./lender-info";
import { formatAprParenthetical } from "./apr-disclosure";

export interface InitialFeesWorksheetPdfMeta {
  address?: string;
  purchasePrice: number;
  loanAmount: number;
  loanTypeLabel: string;
  ratePct: number;
  aprPct: number;
  occupancyLabel?: string;
}

export interface InitialFeesWorksheetPdfInput {
  worksheet: FeeWorksheet;
  meta: InitialFeesWorksheetPdfMeta;
  lenderInfo: PurchaseLenderInfo;
}

function currency(value: number): string {
  return value.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function slugAddress(address?: string): string {
  const slug = (address ?? "property")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
  return slug || "property";
}

export function buildInitialFeesWorksheetFileName(address?: string): string {
  return `initial-fees-worksheet-${slugAddress(address)}.pdf`;
}

export function createInitialFeesWorksheetPdf({
  worksheet,
  meta,
  lenderInfo,
}: InitialFeesWorksheetPdfInput): jsPDF {
  const doc = new jsPDF({ unit: "pt", format: "letter" });
  const width = doc.internal.pageSize.getWidth();
  const height = doc.internal.pageSize.getHeight();
  const margin = 44;
  const contentWidth = width - margin * 2;
  let y = margin;

  const addPage = () => {
    doc.addPage();
    y = margin;
  };
  const ensure = (needed: number) => {
    if (y + needed > height - 50) addPage();
  };
  const writeWrapped = (
    text: string,
    x: number,
    maxWidth: number,
    opts?: { size?: number; color?: [number, number, number]; font?: "normal" | "bold" | "italic" },
  ) => {
    const size = opts?.size ?? 8;
    doc.setFontSize(size);
    doc.setFont("helvetica", opts?.font ?? "normal");
    doc.setTextColor(...(opts?.color ?? [70, 70, 70]));
    const lines = doc.splitTextToSize(text, maxWidth) as string[];
    ensure(lines.length * (size + 3));
    lines.forEach((line) => {
      doc.text(line, x, y);
      y += size + 3;
    });
  };
  const rule = () => {
    doc.setDrawColor(225, 225, 225);
    doc.line(margin, y, width - margin, y);
  };
  const amountRow = (line: FeeLine, indent = false) => {
    ensure(line.note ? 28 : 18);
    const left = margin + (indent ? 14 : 4);
    doc.setFontSize(8.5);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(70, 70, 70);
    doc.text(line.label, left, y + 10);
    doc.setTextColor(25, 25, 25);
    doc.text(currency(line.amount), width - margin - 4, y + 10, { align: "right" });
    if (line.note) {
      doc.setFontSize(7.25);
      doc.setTextColor(120, 120, 120);
      doc.text(line.note, left + 8, y + 20);
      y += 27;
    } else {
      y += 17;
    }
  };
  const textRow = (label: string, value: string, italicLabelSuffix?: string) => {
    ensure(18);
    doc.setFontSize(8.5);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(70, 70, 70);
    doc.text(label, margin + 4, y + 10);
    if (italicLabelSuffix) {
      const suffixX = margin + 4 + doc.getTextWidth(label + " ");
      doc.setFont("helvetica", "italic");
      doc.text(italicLabelSuffix, suffixX, y + 10);
    }
    doc.setFont("helvetica", "bold");
    doc.setTextColor(25, 25, 25);
    doc.text(value, width - margin - 4, y + 10, { align: "right" });
    y += 17;
  };
  const sectionHeader = (title: string, amount?: number) => {
    ensure(28);
    doc.setFillColor(23, 55, 94);
    doc.roundedRect(margin, y, contentWidth, 22, 3, 3, "F");
    doc.setFontSize(9);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(255, 255, 255);
    doc.text(title.toUpperCase(), margin + 9, y + 15);
    if (amount !== undefined) {
      doc.text(currency(amount), width - margin - 9, y + 15, { align: "right" });
    }
    y += 28;
  };
  const subtotal = (label: string, amount: number) => {
    ensure(22);
    rule();
    doc.setFontSize(8.75);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(25, 25, 25);
    doc.text(label, margin + 4, y + 14);
    doc.text(currency(amount), width - margin - 4, y + 14, { align: "right" });
    y += 22;
  };
  const renderSection = (section: FeeSection) => {
    sectionHeader(section.title, section.subtotal);
    section.lines.forEach((line) => amountRow(line));
    (section.groups ?? []).forEach((group) => {
      ensure(20);
      doc.setFontSize(8);
      doc.setFont("helvetica", "bolditalic");
      doc.setTextColor(80, 80, 80);
      doc.text(group.heading, margin + 4, y + 9);
      y += 14;
      group.lines.forEach((line) => amountRow(line, true));
    });
    subtotal(`Total ${section.title}`, section.subtotal);
    y += 6;
  };

  // Branded title.
  doc.setFillColor(23, 55, 94);
  doc.rect(0, 0, width, 70, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.text("Initial Fees Worksheet", margin, 32);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.text(
    new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" }),
    width - margin,
    30,
    { align: "right" },
  );
  if (meta.address) doc.text(meta.address, width - margin, 48, { align: "right" });
  y = 90;

  // Company and loan officer.
  const rightCol = width / 2 + 8;
  doc.setFontSize(8);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(95, 95, 95);
  doc.text("LENDER", margin, y);
  doc.text("LOAN OFFICER", rightCol, y);
  y += 14;
  doc.setFontSize(10);
  doc.setTextColor(25, 25, 25);
  doc.text(lenderInfo.companyName, margin, y);
  doc.text(lenderInfo.loanOfficerName, rightCol, y);
  y += 13;
  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(85, 85, 85);
  doc.text(`Company NMLS #${lenderInfo.companyNmls}`, margin, y);
  doc.text(lenderInfo.loanOfficerTitle, rightCol, y);
  y += 12;
  doc.text(lenderInfo.addressLine1, margin, y);
  doc.text(`Individual MLO NMLS #${lenderInfo.loanOfficerNmls}`, rightCol, y);
  y += 12;
  doc.text(lenderInfo.addressLine2, margin, y);
  y += 18;

  // Loan summary.
  sectionHeader("Loan Summary");
  const summaryRows: Array<[string, string]> = [
    ["Loan Purpose", "Purchase"],
    ["Purchase Price", currency(meta.purchasePrice)],
    ["Loan Amount", currency(meta.loanAmount)],
    ["Product", `30 Year ${meta.loanTypeLabel} Fixed`],
  ];
  if (meta.occupancyLabel) summaryRows.push(["Occupancy", meta.occupancyLabel]);
  summaryRows.forEach(([label, value]) => textRow(label, value));
  textRow(
    "Interest Rate",
    `${meta.ratePct.toFixed(3)}%`,
    formatAprParenthetical(meta.aprPct),
  );
  y += 8;

  renderSection(worksheet.lenderFees);
  renderSection(worksheet.thirdPartyFees);
  renderSection(worksheet.govFees);
  renderSection(worksheet.prepaids);
  renderSection(worksheet.otherFees);

  sectionHeader("Estimated Closing Costs");
  subtotal("Total Estimated Closing Costs", worksheet.totalClosingCosts);
  y += 8;

  sectionHeader(worksheet.monthlyHousing.title);
  worksheet.monthlyHousing.lines.forEach((line) => amountRow(line));
  subtotal("Total Approximated Monthly Payment", worksheet.totalMonthly);
  y += 8;

  sectionHeader("Estimated Funds to Close");
  worksheet.fundsToClose.lines.forEach((line) => amountRow(line));
  subtotal("Funds Due from Borrower (A)", worksheet.fundsToClose.fundsFromBorrower);
  worksheet.fundsToClose.credits.forEach((line) => amountRow(line));
  subtotal("Total Credits Applied (B)", worksheet.fundsToClose.totalCredits);
  subtotal("Estimated Cash from Borrower (A - B)", worksheet.fundsToClose.estimatedCash);
  y += 12;

  sectionHeader("Important Disclosure");
  writeWrapped(
    "This worksheet is an estimate for illustrative and informational purposes only. It is not a Loan Estimate, loan approval, or commitment to lend. Actual fees, rates, APR, and cash required may change. Request an official Loan Estimate before choosing a loan.",
    margin + 4,
    contentWidth - 8,
    { size: 8, font: "italic", color: [95, 95, 95] },
  );

  const pages = doc.getNumberOfPages();
  for (let page = 1; page <= pages; page += 1) {
    doc.setPage(page);
    doc.setFontSize(7);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(130, 130, 130);
    doc.text(`Page ${page} of ${pages}`, width - margin, height - 24, { align: "right" });
  }

  return doc;
}

export function createInitialFeesWorksheetPdfBlob(input: InitialFeesWorksheetPdfInput): Blob {
  return createInitialFeesWorksheetPdf(input).output("blob");
}