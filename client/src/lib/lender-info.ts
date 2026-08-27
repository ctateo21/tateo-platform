export interface PurchaseLoanOfficerInfo {
  loanOfficerName: string;
  loanOfficerTitle: string;
  loanOfficerNmls: string;
}

export interface PurchaseLenderInfo extends PurchaseLoanOfficerInfo {
  companyName: string;
  companyNmls: string;
  addressLine1: string;
  addressLine2: string;
}

const DEFAULT_LOAN_OFFICER: PurchaseLoanOfficerInfo = {
  loanOfficerName: "Paul Christian Tateo",
  loanOfficerTitle: "Mortgage Loan Originator",
  loanOfficerNmls: "1223755",
};

export const PURCHASE_LENDER_INFO: PurchaseLenderInfo = {
  companyName: "Barrett Financial Group LLC",
  companyNmls: "181106",
  ...DEFAULT_LOAN_OFFICER,
  addressLine1: "2701 E Insight Way, Suite 150",
  addressLine2: "Chandler, AZ 85286",
};

const STAFF_LOAN_OFFICERS: ReadonlyArray<{
  email: string;
  names: readonly string[];
  info: PurchaseLoanOfficerInfo;
}> = [
  {
    email: "omar@tateoco.com",
    names: ["omar andujar"],
    info: {
      loanOfficerName: "Omar Andujar",
      loanOfficerTitle: "Mortgage Loan Originator",
      loanOfficerNmls: "1806169",
    },
  },
  {
    email: "kyle@tateoco.com",
    names: ["kyle schweinitz"],
    info: {
      loanOfficerName: "Kyle Schweinitz",
      loanOfficerTitle: "Mortgage Loan Originator",
      loanOfficerNmls: "2140291",
    },
  },
  {
    email: "alex@tateoco.com",
    names: ["alex szabo", "sandor szabo", "sandor alex szabo"],
    info: {
      loanOfficerName: "Sandor “Alex” Szabo",
      loanOfficerTitle: "Mortgage Loan Originator",
      loanOfficerNmls: "2857504",
    },
  },
];

function normalizeStaffIdentity(value: string | null | undefined): string {
  return (value ?? "")
    .toLowerCase()
    .replace(/[“”"'’]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export function resolvePurchaseLenderInfo(
  user: { email?: string | null; name?: string | null } | null | undefined,
): PurchaseLenderInfo {
  const email = (user?.email ?? "").trim().toLowerCase();
  const name = normalizeStaffIdentity(user?.name);
  const staffOfficer = STAFF_LOAN_OFFICERS.find(
    (officer) =>
      officer.email === email ||
      (name.length > 0 && officer.names.some((alias) => normalizeStaffIdentity(alias) === name)),
  );

  return {
    ...PURCHASE_LENDER_INFO,
    ...(staffOfficer?.info ?? DEFAULT_LOAN_OFFICER),
  };
}