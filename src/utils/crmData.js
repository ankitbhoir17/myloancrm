import { apiFetch, cacheLocalSnapshot } from './api';
import { normalizeLoanRecord } from './loanWorkflow';

export const CUSTOMERS_CACHE_KEY = 'customers';
export const LOANS_CACHE_KEY = 'loans';

function readJson(key, fallback = []) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch (error) {
    return fallback;
  }
}

export function normalizeCustomerRecord(customer) {
  const id = customer?.id || customer?._id || '';
  const loanCount = Number(
    customer?.loanCount ??
    (Array.isArray(customer?.loans) ? customer.loans.length : customer?.loans) ??
    0
  );

  return {
    id: String(id),
    name: customer?.name || [customer?.firstName, customer?.lastName].filter(Boolean).join(' ').trim(),
    email: customer?.email || '',
    phone: customer?.phone || '',
    address: customer?.address || '',
    status: customer?.status || 'Active',
    joinDate: customer?.joinDate || '',
    dateOfBirth: customer?.dateOfBirth || '',
    occupation: customer?.occupation || '',
    income: Number(customer?.income || 0),
    panNumber: customer?.panNumber || '',
    aadharNumber: customer?.aadharNumber || '',
    loans: Array.isArray(customer?.loans) ? customer.loans : loanCount,
    loanCount,
    totalAmount: Number(customer?.totalAmount || 0),
    documents: Array.isArray(customer?.documents) ? customer.documents : [],
    activities: Array.isArray(customer?.activities) ? customer.activities : [],
  };
}

export function normalizeLoanApiRecord(loan) {
  return normalizeLoanRecord({
    id: String(loan?.id || loan?._id || ''),
    customerId: loan?.customerId ? String(loan.customerId) : '',
    customer: loan?.customer || '',
    lenderName: loan?.lenderName || '',
    referenceName: loan?.referenceName || '',
    email: loan?.email || '',
    phone: loan?.phone || '',
    amount: Number(loan?.amount || 0),
    type: loan?.type || 'Personal',
    status: loan?.status || '',
    interest: Number(loan?.interest || loan?.interestRate || 0),
    tenure: Number(loan?.tenure || 0),
    tenureUnit: loan?.tenureUnit || 'years',
    date: loan?.date || '',
    emi: Number(loan?.emi || 0),
    disbursedAmount: Number(loan?.disbursedAmount || 0),
    outstandingAmount: Number(loan?.outstandingAmount || 0),
    appliedDate: loan?.appliedDate || '',
    approvedDate: loan?.approvedDate || '',
    disbursedDate: loan?.disbursedDate || '',
    nextEmiDate: loan?.nextEmiDate || '',
    documents: Array.isArray(loan?.documents) ? loan.documents : [],
    emiHistory: Array.isArray(loan?.emiHistory) ? loan.emiHistory : [],
  });
}

export function readCachedCustomers() {
  return readJson(CUSTOMERS_CACHE_KEY, []).map(normalizeCustomerRecord);
}

export function readCachedLoans() {
  return readJson(LOANS_CACHE_KEY, []).map(normalizeLoanApiRecord);
}

export function writeCachedCustomers(customers) {
  cacheLocalSnapshot(CUSTOMERS_CACHE_KEY, customers);
}

export function writeCachedLoans(loans) {
  cacheLocalSnapshot(LOANS_CACHE_KEY, loans);
}

export async function syncCustomersCache() {
  const payload = await apiFetch('/api/customers');
  const customers = (payload?.data || []).map(normalizeCustomerRecord);
  writeCachedCustomers(customers);
  return customers;
}

export async function syncLoansCache() {
  const payload = await apiFetch('/api/loans');
  const loans = (payload?.data || []).map(normalizeLoanApiRecord);
  writeCachedLoans(loans);
  return loans;
}

export async function syncCrmCaches() {
  const [customers, loans] = await Promise.all([
    syncCustomersCache(),
    syncLoansCache(),
  ]);

  return { customers, loans };
}

export async function fetchCustomerRecord(id) {
  const payload = await apiFetch(`/api/customers/${id}`);
  return normalizeCustomerRecord(payload?.data);
}

export async function createCustomerRecord(customer) {
  const payload = await apiFetch('/api/customers', {
    method: 'POST',
    body: customer,
  });
  return normalizeCustomerRecord(payload?.data);
}

export async function updateCustomerRecord(id, customer) {
  const payload = await apiFetch(`/api/customers/${id}`, {
    method: 'PUT',
    body: customer,
  });
  return normalizeCustomerRecord(payload?.data);
}

export async function deleteCustomerRecord(id) {
  await apiFetch(`/api/customers/${id}`, { method: 'DELETE' });
}

export async function fetchLoanRecord(id) {
  const payload = await apiFetch(`/api/loans/${id}`);
  return normalizeLoanApiRecord(payload?.data);
}

export async function createLoanRecord(loan) {
  const payload = await apiFetch('/api/loans', {
    method: 'POST',
    body: loan,
  });
  return normalizeLoanApiRecord(payload?.data);
}

export async function updateLoanRecord(id, loan) {
  const payload = await apiFetch(`/api/loans/${id}`, {
    method: 'PUT',
    body: loan,
  });
  return normalizeLoanApiRecord(payload?.data);
}

export async function deleteLoanRecord(id) {
  await apiFetch(`/api/loans/${id}`, { method: 'DELETE' });
}
