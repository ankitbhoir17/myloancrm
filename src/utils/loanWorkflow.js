export const LOAN_STATUS_FLOW = [
  'Leads',
  'Login Doccs Pending',
  'Login Done',
  'Sanctioned',
  'Rejected',
  'Property Doccs Pending',
  'Legal & Tech Innitiated',
  'Legal Tech Done',
  'Docket Pending',
  'Disbursement In Process',
  'Disbursed',
  'Payout Pending',
  'Payout Received',
  'Payout Paid',
];

export const DEFAULT_LOAN_STATUS = LOAN_STATUS_FLOW[0];

const LOAN_STATUS_ICON_MAP = {
  Leads: '\u25C7',
  'Login Doccs Pending': '\u23F3',
  'Login Done': '\u2713',
  Sanctioned: '\u2714',
  Rejected: '\u2715',
  'Property Doccs Pending': '\u2302',
  'Legal & Tech Innitiated': '\u2696',
  'Legal Tech Done': '\u2713',
  'Docket Pending': '\u2630',
  'Disbursement In Process': '\u27F3',
  Disbursed: '\u20B9',
  'Payout Pending': '\u23F3',
  'Payout Received': '\u2193',
  'Payout Paid': '\u2714',
};

export function getLoanStatusSlug(status) {
  return String(status || '')
    .trim()
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export const LOAN_STATUS_MENU_ITEMS = LOAN_STATUS_FLOW.map((status) => ({
  status,
  slug: getLoanStatusSlug(status),
  icon: LOAN_STATUS_ICON_MAP[status] || '\u2022',
}));

const LEGACY_STATUS_MAP = {
  pending: 'Leads',
  approved: 'Sanctioned',
  active: 'Disbursed',
  disbursed: 'Disbursed',
  rejected: 'Rejected',
};

export function normalizeLoanStatus(status) {
  if (!status) {
    return DEFAULT_LOAN_STATUS;
  }

  const cleaned = String(status).trim();
  const directMatch = LOAN_STATUS_FLOW.find((item) => item.toLowerCase() === cleaned.toLowerCase());
  if (directMatch) {
    return directMatch;
  }

  return LEGACY_STATUS_MAP[cleaned.toLowerCase()] || DEFAULT_LOAN_STATUS;
}

export function getLoanStatusBySlug(slug) {
  return LOAN_STATUS_MENU_ITEMS.find((item) => item.slug === slug)?.status || null;
}

export function normalizeLoanTenureYears(loan) {
  const rawTenure = Number(loan?.tenure) || 0;
  if (!rawTenure) {
    return 0;
  }

  if (loan?.tenureUnit === 'years') {
    return rawTenure;
  }

  return Number((rawTenure / 12).toFixed(2));
}

export function normalizeLoanRecord(loan) {
  return {
    ...loan,
    loanId: String(loan?.loanId || '').trim(),
    status: normalizeLoanStatus(loan?.status),
    tenure: normalizeLoanTenureYears(loan),
    tenureUnit: 'years',
  };
}

export function formatLoanDisplayId(loan) {
  const manualLoanId = String(loan?.loanId || '').trim();
  if (manualLoanId) {
    return manualLoanId;
  }

  const fallbackId = String(loan?.id || loan?._id || '').trim();
  if (!fallbackId) {
    return '-';
  }

  return `#${fallbackId.padStart(4, '0')}`;
}

export function getLoanCreatedDate(loan) {
  const rawValue = loan?.createdAt || loan?.date || '';
  if (!rawValue) {
    return null;
  }

  const parsed = new Date(rawValue);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function formatLoanCreatedAt(loan) {
  const parsed = getLoanCreatedDate(loan);
  if (parsed) {
    return parsed.toLocaleString();
  }

  return loan?.date || '-';
}

export function formatTenureYears(value) {
  const numeric = Number(value) || 0;
  if (!numeric) {
    return '-';
  }

  const formatted = Number.isInteger(numeric) ? numeric.toString() : numeric.toFixed(2).replace(/\.?0+$/, '');
  return `${formatted} ${numeric === 1 ? 'year' : 'years'}`;
}

export function getLoanStatusTone(status) {
  switch (normalizeLoanStatus(status)) {
    case 'Sanctioned':
      return 'approved';
    case 'Rejected':
      return 'rejected';
    case 'Disbursed':
      return 'disbursed';
    case 'Payout Paid':
      return 'paid';
    case 'Payout Pending':
    case 'Payout Received':
      return 'active';
    default:
      return 'pending';
  }
}
