import { apiFetch, cacheLocalSnapshot } from './api';

export const LEADS_CACHE_KEY = 'leads';

function readJson(key, fallback = []) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch (error) {
    return fallback;
  }
}

function normalizeDate(value, fallback = '') {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? fallback : date.toISOString().slice(0, 10);
}

export function normalizeLeadRecord(lead) {
  return {
    id: String(lead?.id || lead?._id || ''),
    businessName: lead?.businessName || '',
    businessEntity: lead?.businessEntity || '',
    contactPerson: lead?.contactPerson || '',
    primaryPhone: lead?.primaryPhone || lead?.phone || '',
    city: lead?.city || '',
    sourcedBy: lead?.sourcedBy || '',
    createdDate: lead?.createdDate || normalizeDate(lead?.createdAt, ''),
    status: lead?.status || 'New',
    loanType: lead?.loanType || 'Business Loans',
  };
}

export function readCachedLeads() {
  return readJson(LEADS_CACHE_KEY, []).map(normalizeLeadRecord);
}

export function writeCachedLeads(leads) {
  cacheLocalSnapshot(LEADS_CACHE_KEY, leads);
}

export async function syncLeadsCache() {
  const payload = await apiFetch('/api/leads');
  const leads = (payload?.data || []).map(normalizeLeadRecord);
  writeCachedLeads(leads);
  return leads;
}

export async function createLeadRecord(lead) {
  const payload = await apiFetch('/api/leads', {
    method: 'POST',
    body: lead,
  });
  return normalizeLeadRecord(payload?.data);
}

export async function updateLeadRecord(id, lead) {
  const payload = await apiFetch(`/api/leads/${id}`, {
    method: 'PUT',
    body: lead,
  });
  return normalizeLeadRecord(payload?.data);
}

export async function deleteLeadRecord(id) {
  await apiFetch(`/api/leads/${id}`, { method: 'DELETE' });
}

export async function createManyLeadRecords(items) {
  const payload = await apiFetch('/api/leads/bulk', {
    method: 'POST',
    body: { items },
  });
  return (payload?.data || []).map(normalizeLeadRecord);
}
