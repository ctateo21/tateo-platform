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

const NAVY: [number, number, number] = [20, 31, 70];
const INK: [number, number, number] = [35, 38, 45];
const MUTED: [number, number, number] = [92, 96, 105];
const BORDER: [number, number, number] = [210, 213, 219];
const PANEL: [number, number, number] = [244, 245, 247];

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

function findLineAmount(section: FeeSection, label: string): number {
  return [
    ...section.lines,
    ...(section.groups ?? []).flatMap((group) => group.lines),
  ].find((line) => line.label === label)?.amount ?? 0;
}

export function createInitialFeesWorksheetPdf({
  worksheet,
  meta,
  lenderInfo,
}: InitialFeesWorksheetPdfInput): jsPDF {
  const doc = new jsPDF({ unit: "pt", format: "letter" });
  const width = doc.internal.pageSize.getWidth();
  const height = doc.internal.pageSize.getHeight();
  const margin = 30;
  const gap = 14;
  const columnWidth = (width - margin * 2 - gap) / 2;

  const setText = (
    size: number,
    font: "normal" | "bold" | "italic" | "bolditalic" = "normal",
    color: [number, number, number] = INK,
  ) => {
    doc.setFont("helvetica", font);
    doc.setFontSize(size);
    doc.setTextColor(...color);
  };

  const pageFooter = (page: number, total: number) => {
    setText(6.5, "normal", MUTED);
    doc.text(
      `${lenderInfo.companyName} · Company NMLS #${lenderInfo.companyNmls}`,
      margin,
      height - 11,
    );
    doc.text(`Page ${page} of ${total}`, width - margin, height - 11, {
      align: "right",
    });
  };

  const pageOneHeader = () => {
    setText(10, "bold");
    doc.text(lenderInfo.loanOfficerName, margin, 24);
    setText(6.8, "normal", MUTED);
    doc.text(
      `NMLS #${lenderInfo.loanOfficerNmls} · ${lenderInfo.loanOfficerTitle}`,
      margin,
      35,
    );
    doc.text(lenderInfo.companyName, margin, 46);

    setText(17, "bold", NAVY);
    doc.text("INITIAL FEES WORKSHEET", width - margin, 28, {
      align: "right",
    });
    setText(7, "normal", MUTED);
    doc.text(
      new Date().toLocaleDateString("en-US", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }),
      width - margin,
      42,
      { align: "right" },
    );

    doc.setDrawColor(...NAVY);
    doc.setLineWidth(1.2);
    doc.line(0, 58, width, 58);

    setText(8, "bold", INK);
    doc.text(
      "Your actual rate, payment and costs could be higher. Get an official Loan Estimate before choosing a loan.",
      width / 2,
      75,
      { align: "center" },
    );
  };

  const summaryItem = (
    label: string,
    value: string,
    x: number,
    y: number,
    itemWidth: number,
  ) => {
    setText(6.8, "normal", MUTED);
    doc.text(`${label}:`, x, y);
    setText(7.2, "bold", INK);
    const valueLines = doc.splitTextToSize(value, itemWidth - 65) as string[];
    doc.text(valueLines.slice(0, 2), x + 62, y);
  };

  const renderSummary = () => {
    const top = 88;
    const boxHeight = 70;
    const innerX = margin + 8;
    const itemWidth = (width - margin * 2 - 16) / 3;
    doc.setFillColor(250, 250, 251);
    doc.setDrawColor(...BORDER);
    doc.rect(margin, top, width - margin * 2, boxHeight, "FD");

    const columns: Array<Array<[string, string]>> = [
      [
        ["Loan Purpose", "Purchase"],
        ["Property Type", "Single Family (1–4 Units)"],
        ["Product", `30 Year ${meta.loanTypeLabel} Fixed`],
      ],
      [
        ["Purchase Price", currency(meta.purchasePrice)],
        ["Occupancy", meta.occupancyLabel ?? "Not specified"],
        [
          "Rate / APR",
          `${meta.ratePct.toFixed(3)}% / ${meta.aprPct.toFixed(3)}%`,
        ],
      ],
      [
        ["Loan Amount", currency(meta.loanAmount)],
        ["Property", meta.address ?? "Address not provided"],
        ["Term", "360 Months"],
      ],
    ];

    columns.forEach((items, columnIndex) => {
      const x = innerX + itemWidth * columnIndex;
      items.forEach(([label, value], rowIndex) => {
        summaryItem(label, value, x, top + 17 + rowIndex * 18, itemWidth - 8);
      });
    });
  };

  const sectionHeader = (
    section: FeeSection,
    x: number,
    y: number,
    sectionWidth: number,
  ): number => {
    doc.setFillColor(...PANEL);
    doc.setDrawColor(...BORDER);
    doc.rect(x, y, sectionWidth, 20, "FD");
    setText(7.6, "bold", NAVY);
    const title = doc.splitTextToSize(
      section.title,
      sectionWidth - 92,
    ) as string[];
    doc.text(title[0], x + 8, y + 13);
    doc.text(currency(section.subtotal), x + sectionWidth - 8, y + 13, {
      align: "right",
    });
    return y + 24;
  };

  const amountRow = (
    line: FeeLine,
    x: number,
    y: number,
    sectionWidth: number,
    indent = false,
  ): number => {
    const labelX = x + 8 + (indent ? 8 : 0);
    const amountWidth = 66;
    const labelWidth = sectionWidth - (labelX - x) - amountWidth - 8;
    const fullLabel = line.note
      ? `${line.label} (${line.note})`
      : line.label;
    setText(6.7, "normal", MUTED);
    const lines = doc.splitTextToSize(fullLabel, labelWidth) as string[];
    doc.text(lines.slice(0, 2), labelX, y + 7);
    setText(6.8, "normal", INK);
    doc.text(currency(line.amount), x + sectionWidth - 8, y + 7, {
      align: "right",
    });
    return y + Math.max(11, Math.min(lines.length, 2) * 8);
  };

  const renderSection = (
    section: FeeSection,
    x: number,
    y: number,
    sectionWidth: number,
  ): number => {
    let cursor = sectionHeader(section, x, y, sectionWidth);
    section.lines.forEach((line) => {
      cursor = amountRow(line, x, cursor, sectionWidth);
    });
    (section.groups ?? []).forEach((group) => {
      setText(6.8, "bold", INK);
      doc.text(group.heading, x + 8, cursor + 7);
      cursor += 12;
      group.lines.forEach((line) => {
        cursor = amountRow(line, x, cursor, sectionWidth, true);
      });
      cursor += 2;
    });
    return cursor + 8;
  };

  const renderBottomPanel = (
    title: string,
    lines: FeeLine[],
    totalLabel: string,
    total: number,
    x: number,
    y: number,
    panelWidth: number,
    credits?: { lines: FeeLine[]; total: number },
  ) => {
    const panelHeight = 184;
    doc.setDrawColor(...BORDER);
    doc.rect(x, y, panelWidth, panelHeight);
    doc.setFillColor(...PANEL);
    doc.rect(x, y, panelWidth, 20, "F");
    setText(7.5, "bold", NAVY);
    doc.text(title, x + 8, y + 13);
    let cursor = y + 27;
    lines.forEach((line) => {
      cursor = amountRow(line, x, cursor, panelWidth);
    });
    if (credits) {
      doc.setDrawColor(...BORDER);
      doc.line(x + 8, cursor + 1, x + panelWidth - 8, cursor + 1);
      cursor += 7;
      credits.lines.forEach((line) => {
        cursor = amountRow(line, x, cursor, panelWidth);
      });
      setText(6.7, "bold", INK);
      doc.text("Total Credits Applied (B)", x + 8, cursor + 7);
      doc.text(currency(credits.total), x + panelWidth - 8, cursor + 7, {
        align: "right",
      });
    }

    doc.setFillColor(250, 250, 251);
    doc.rect(x, y + panelHeight - 22, panelWidth, 22, "F");
    doc.setDrawColor(...NAVY);
    doc.setLineWidth(0.8);
    doc.rect(x, y + panelHeight - 22, panelWidth, 22);
    setText(7, "bold", NAVY);
    doc.text(totalLabel, x + 8, y + panelHeight - 8);
    doc.text(currency(total), x + panelWidth - 8, y + panelHeight - 8, {
      align: "right",
    });
  };

  pageOneHeader();
  renderSummary();

  const feeTop = 174;
  let leftY = feeTop;
  leftY = renderSection(
    worksheet.lenderFees,
    margin,
    leftY,
    columnWidth,
  );
  renderSection(
    worksheet.thirdPartyFees,
    margin,
    leftY,
    columnWidth,
  );

  const rightX = margin + columnWidth + gap;
  let rightY = feeTop;
  rightY = renderSection(
    worksheet.govFees,
    rightX,
    rightY,
    columnWidth,
  );
  rightY = renderSection(
    worksheet.prepaids,
    rightX,
    rightY,
    columnWidth,
  );
  renderSection(
    worksheet.otherFees,
    rightX,
    rightY,
    columnWidth,
  );

  const bottomY = 546;
  renderBottomPanel(
    worksheet.monthlyHousing.title,
    worksheet.monthlyHousing.lines,
    "TOTAL APPROXIMATED MONTHLY PAYMENT",
    worksheet.totalMonthly,
    margin,
    bottomY,
    columnWidth,
  );
  renderBottomPanel(
    "Estimated Funds to Close",
    worksheet.fundsToClose.lines,
    "ESTIMATED CASH FROM BORROWER (A - B)",
    worksheet.fundsToClose.estimatedCash,
    rightX,
    bottomY,
    columnWidth,
    {
      lines: worksheet.fundsToClose.credits,
      total: worksheet.fundsToClose.totalCredits,
    },
  );

  setText(5.7, "italic", MUTED);
  const disclosure = doc.splitTextToSize(
    "This estimate is for illustrative and informational purposes only and is not a Loan Estimate, loan approval, or commitment to lend. Rates, APR, fees, and cash required may change. " +
      `Interest Rate ${meta.ratePct.toFixed(3)}%. Request an official Loan Estimate before choosing a loan.`,
    width - margin * 2,
  ) as string[];
  doc.text(disclosure.slice(0, 3), margin, 741);
  setText(5.7, "italic", MUTED);
  doc.text(formatAprParenthetical(meta.aprPct), margin, 766);

  // Page 2: payment timing. These are estimates, not new charges; every
  // amount is reconciled back to the same worksheet used on page 1.
  doc.addPage();
  doc.setFillColor(...NAVY);
  doc.rect(0, 0, width, 62, "F");
  setText(18, "bold", [255, 255, 255]);
  doc.text("WHEN MONEY IS DUE", margin, 30);
  setText(8, "normal", [220, 225, 236]);
  doc.text(
    "A practical purchase-process timeline for the estimates on page 1",
    margin,
    46,
  );
  setText(7, "normal", [220, 225, 236]);
  doc.text(meta.address ?? "Property address not provided", width - margin, 42, {
    align: "right",
  });

  setText(8, "normal", MUTED);
  const intro = doc.splitTextToSize(
    "Exact due dates come from your purchase contract, lender, inspector, and title company. Confirm wiring instructions by calling the title company at a trusted phone number before sending funds.",
    width - margin * 2,
  ) as string[];
  doc.text(intro, margin, 84);

  const earnestMoney = Math.round(meta.purchasePrice * 0.01);
  const inspectionAmount =
    findLineAmount(worksheet.otherFees, "Home Inspection") +
    findLineAmount(worksheet.otherFees, "Elevation Certificate");
  const appraisalAmount = findLineAmount(
    worksheet.thirdPartyFees,
    "Appraisal Fee",
  );
  const isVaLoan = /\bVA\b/i.test(meta.loanTypeLabel);
  const appraisalDueBeforeClosing = isVaLoan ? 0 : appraisalAmount;
  const beforeClosing =
    earnestMoney + inspectionAmount + appraisalDueBeforeClosing;
  const closingRemainder = Math.max(
    0,
    worksheet.fundsToClose.estimatedCash - beforeClosing,
  );

  const stages = [
    {
      step: "1",
      timing: "AFTER THE OFFER IS ACCEPTED",
      title: "Earnest money deposit",
      amount: earnestMoney,
      body:
        "Often due within 1–3 business days after contract acceptance. The signed contract controls the amount, deadline, and escrow holder.",
    },
    {
      step: "2",
      timing: "DURING THE INSPECTION PERIOD",
      title: "Inspections and due diligence",
      amount: inspectionAmount,
      body:
        "Usually paid directly when services are scheduled or completed. This estimate includes the home inspection and any required elevation certificate.",
    },
    {
      step: "3",
      timing: "AFTER LOAN APPLICATION / WHEN ORDERED",
      title: "Appraisal",
      amount: appraisalDueBeforeClosing,
      body: isVaLoan
        ? `A VA appraisal is shown on page 1 at ${currency(appraisalAmount)} but is estimated here as collected at closing. Your lender will confirm.`
        : "The lender or appraisal portal commonly collects this amount before the appraisal is ordered.",
    },
    {
      step: "4",
      timing: "BEFORE OR ON CLOSING DAY",
      title: "Remaining estimated cash to close",
      amount: closingRemainder,
      body:
        "Your title company will provide the final amount and approved payment method after the official Closing Disclosure. Earlier deposits shown above reduce this estimated remainder.",
    },
  ];

  const lineX = 55;
  const cardX = 82;
  const cardWidth = width - cardX - margin;
  const firstY = 122;
  const cardHeight = 105;
  const cardGap = 17;
  doc.setDrawColor(187, 193, 207);
  doc.setLineWidth(2);
  doc.line(
    lineX,
    firstY + 14,
    lineX,
    firstY + (cardHeight + cardGap) * (stages.length - 1) + 14,
  );

  stages.forEach((stage, index) => {
    const y = firstY + index * (cardHeight + cardGap);
    doc.setFillColor(...NAVY);
    doc.circle(lineX, y + 14, 12, "F");
    setText(8, "bold", [255, 255, 255]);
    doc.text(stage.step, lineX, y + 17, { align: "center" });

    doc.setDrawColor(...BORDER);
    doc.setFillColor(250, 250, 251);
    doc.roundedRect(cardX, y, cardWidth, cardHeight, 3, 3, "FD");
    setText(6.8, "bold", MUTED);
    doc.text(stage.timing, cardX + 12, y + 17);
    setText(11, "bold", NAVY);
    doc.text(stage.title, cardX + 12, y + 36);
    setText(12, "bold", NAVY);
    doc.text(currency(stage.amount), cardX + cardWidth - 12, y + 36, {
      align: "right",
    });
    setText(7.6, "normal", MUTED);
    const body = doc.splitTextToSize(
      stage.body,
      cardWidth - 24,
    ) as string[];
    doc.text(body, cardX + 12, y + 56);
  });

  const summaryY = 625;
  doc.setFillColor(...NAVY);
  doc.roundedRect(margin, summaryY, width - margin * 2, 78, 4, 4, "F");
  setText(8, "bold", [220, 225, 236]);
  doc.text("ESTIMATED PAYMENT TIMING SUMMARY", margin + 14, summaryY + 18);
  setText(8, "normal", [255, 255, 255]);
  doc.text("Estimated before closing", margin + 14, summaryY + 40);
  doc.text("Estimated remaining at closing", margin + 14, summaryY + 59);
  setText(10, "bold", [255, 255, 255]);
  doc.text(currency(beforeClosing), width - margin - 14, summaryY + 40, {
    align: "right",
  });
  doc.text(currency(closingRemainder), width - margin - 14, summaryY + 59, {
    align: "right",
  });

  setText(7, "italic", MUTED);
  const timingDisclosure = doc.splitTextToSize(
    `The timing amounts above allocate the estimated cash from borrower shown on page 1; they do not add new charges. Total estimated cash from borrower: ${currency(worksheet.fundsToClose.estimatedCash)}. Seller, lender, and assistance credits are reflected in that total.`,
    width - margin * 2,
  ) as string[];
  doc.text(timingDisclosure, margin, 723);

  pageFooter(1, 2);
  doc.setPage(2);
  pageFooter(2, 2);
  return doc;
}

export function createInitialFeesWorksheetPdfBlob(
  input: InitialFeesWorksheetPdfInput,
): Blob {
  return createInitialFeesWorksheetPdf(input).output("blob");
}