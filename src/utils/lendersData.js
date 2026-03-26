import { apiFetch, cacheLocalSnapshot } from './api';

export const LENDERS_CACHE_KEY = 'lenders';

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

export function normalizeLenderRecord(lender, fallbackId = '') {
  return {
    id: String(lender?.id || lender?._id || fallbackId),
    name: String(lender?.name || `Lender ${fallbackId}`).trim(),
    image: lender?.image || '',
    createdAt: lender?.createdAt || normalizeDate(lender?.created_at, normalizeDate(new Date(), '')),
    status: lender?.status || 'Inactive',
    metadata: lender?.metadata || {},
    loginsCount: Number(lender?.loginsCount || 0),
    lastLoginDate: lender?.lastLoginDate || '',
    lastLoginStatus: lender?.lastLoginStatus || '',
  };
}

export function readCachedLenders() {
  return readJson(LENDERS_CACHE_KEY, []).map((item, index) => normalizeLenderRecord(item, index + 1));
}

export function writeCachedLenders(lenders) {
  cacheLocalSnapshot(LENDERS_CACHE_KEY, lenders);
}

export async function syncLendersCache() {
  const payload = await apiFetch('/api/lenders');
  const lenders = (payload?.data || []).map((item, index) => normalizeLenderRecord(item, index + 1));
  writeCachedLenders(lenders);
  return lenders;
}

export async function createLenderRecord(lender) {
  const payload = await apiFetch('/api/lenders', {
    method: 'POST',
    body: lender,
  });
  return normalizeLenderRecord(payload?.data);
}

export async function updateLenderRecord(id, lender) {
  const payload = await apiFetch(`/api/lenders/${id}`, {
    method: 'PUT',
    body: lender,
  });
  return normalizeLenderRecord(payload?.data);
}

export async function deleteLenderRecord(id) {
  await apiFetch(`/api/lenders/${id}`, { method: 'DELETE' });
}
