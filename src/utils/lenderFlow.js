import { getStoredLenderLogins } from './lenderLogins';
import { LOAN_STATUS_FLOW, getLoanStatusTone, normalizeLoanRecord } from './loanWorkflow';
import { readCachedLoans, writeCachedLoans } from './crmData';

const SANCTIONED_STATUSES = new Set([
  'Sanctioned',
  'Property Doccs Pending',
  'Legal & Tech Innitiated',
  'Legal Tech Done',
  'Docket Pending',
  'Disbursement In Process',
  'Disbursed',
  'Payout Pending',
  'Payout Received',
  'Payout Paid',
]);

const DISBURSED_STATUSES = new Set([
  'Disbursed',
  'Payout Pending',
  'Payout Received',
  'Payout Paid',
]);

const IN_FLOW_EXCLUDED = new Set(['Disbursed', 'Payout Paid', 'Rejected']);

function readJson(key) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch (error) {
    return null;
  }
}

function asTime(value) {
  const parsed = new Date(value);
  const time = parsed.getTime();
  return Number.isNaN(time) ? 0 : time;
}

function dispatchStorageChange(key) {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('app:storage-changed', { detail: { key } }));
  }
}

export function normalizeLenderName(name) {
  return String(name || '').trim().toLowerCase();
}

export function hasLinkedLenderCases(lenderName, loans = readStoredLoans()) {
  return getRelatedLenderLoans(lenderName, loans).length > 0;
}

export function readStoredLoans() {
  return readCachedLoans().map(normalizeLoanRecord);
}

export function persistStoredLoans(loans) {
  writeCachedLoans(loans);
  dispatchStorageChange('loans');
}

export function mergeLendersWithFlow(lenders = [], loans = readStoredLoans()) {
  const existing = [];
  const byName = new Map();
  (Array.isArray(lenders) ? lenders : []).forEach((item) => {
    const cloned = { ...item };
    const key = normalizeLenderName(cloned.name);
    if (!key || byName.has(key)) {
      return;
    }
    existing.push(cloned);
    byName.set(key, cloned);
  });
  let nextId = existing.reduce((max, item) => Math.max(max, Number(item.id) || 0), 0);

  loans.forEach((loan) => {
    const lenderName = String(loan?.lenderName || '').trim();
    if (!lenderName) {
      return;
    }

    const key = normalizeLenderName(lenderName);
    if (byName.has(key)) {
      const current = byName.get(key);
      if ((!current.createdAt || current.createdAt === '-') && loan.date) {
        current.createdAt = loan.date;
      }
      return;
    }

    nextId += 1;
    const inferred = {
      id: nextId,
      name: lenderName,
      image: '',
      createdAt: loan.date || new Date().toISOString().slice(0, 10),
    };
    existing.push(inferred);
    byName.set(key, inferred);
  });

  return existing
    .filter((item) => hasLinkedLenderCases(item.name, loans))
    .map((item) => {
      const relatedLoans = getRelatedLenderLoans(item.name, loans);
      const inFlowCases = relatedLoans.filter((loan) => !IN_FLOW_EXCLUDED.has(loan.status)).length;
      return {
        ...item,
        status: inFlowCases > 0 || getStoredLenderLogins(item.id).length > 0
          ? 'Active'
          : 'Inactive',
      };
    });
}

export function renameLenderInLoans(previousName, nextName, loans = readStoredLoans()) {
  const from = normalizeLenderName(previousName);
  const to = String(nextName || '').trim();

  if (!from || !to || from === normalizeLenderName(to)) {
    return loans;
  }

  const nextLoans = loans.map((loan) => (
    normalizeLenderName(loan?.lenderName) === from
      ? { ...loan, lenderName: to }
      : loan
  ));

  persistStoredLoans(nextLoans);
  return nextLoans.map(normalizeLoanRecord);
}

export function getRelatedLenderLoans(lenderName, loans = readStoredLoans()) {
  const normalizedName = normalizeLenderName(lenderName);
  return loans
    .filter((loan) => normalizeLenderName(loan?.lenderName) === normalizedName)
    .sort((a, b) => asTime(b.date) - asTime(a.date));
}

export function getLoanFlowBreakdown(loans) {
  return LOAN_STATUS_FLOW.map((status) => ({
    status,
    count: loans.filter((loan) => loan.status === status).length,
    tone: getLoanStatusTone(status),
  }));
}

export function formatCurrency(value) {
  return `Rs. ${Number(value || 0).toLocaleString()}`;
}

export function buildLenderInsight(lender, loans = readStoredLoans()) {
  const relatedLoans = getRelatedLenderLoans(lender.name, loans);
  const logins = getStoredLenderLogins(lender.id);
  const flowBreakdown = getLoanFlowBreakdown(relatedLoans);
  const totalCases = relatedLoans.length;
  const totalAmount = relatedLoans.reduce((sum, loan) => sum + Number(loan.amount || 0), 0);
  const inFlowCases = relatedLoans.filter((loan) => !IN_FLOW_EXCLUDED.has(loan.status)).length;
  const sanctionedCases = relatedLoans.filter((loan) => SANCTIONED_STATUSES.has(loan.status)).length;
  const disbursedCases = relatedLoans.filter((loan) => DISBURSED_STATUSES.has(loan.status)).length;
  const currentFlow = relatedLoans.reduce((best, loan) => {
    const currentIndex = LOAN_STATUS_FLOW.indexOf(loan.status);
    const bestIndex = LOAN_STATUS_FLOW.indexOf(best?.status || '');
    if (currentIndex > bestIndex) {
      return loan;
    }
    if (currentIndex === bestIndex && asTime(loan.date) > asTime(best?.date)) {
      return loan;
    }
    return best;
  }, null);
  const activeFlowCounts = flowBreakdown.filter((item) => item.count > 0);

  return {
    ...lender,
    status: inFlowCases > 0 || logins.length > 0 ? 'Active' : 'Inactive',
    relatedLoans,
    flowBreakdown,
    totalCases,
    totalAmount,
    inFlowCases,
    sanctionedCases,
    disbursedCases,
    currentFlow: currentFlow?.status || 'No Cases',
    currentFlowTone: currentFlow ? getLoanStatusTone(currentFlow.status) : 'pending',
    currentFlowDate: currentFlow?.date || '',
    activeFlowCounts,
    logins,
    loginsCount: logins.length,
    lastLoginDate: logins[0]?.loginDate || '',
    lastLoginStatus: logins[0]?.status || '',
  };
}
