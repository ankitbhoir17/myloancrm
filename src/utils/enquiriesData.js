import { apiFetch, cacheLocalSnapshot } from './api';

export const ENQUIRIES_CACHE_KEY = 'enquiries';

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

export function normalizeEnquiryRecord(enquiry) {
  return {
    id: String(enquiry?.id || enquiry?._id || ''),
    customerId: enquiry?.customerId ? String(enquiry.customerId) : '',
    customerName: enquiry?.customerName || '',
    email: enquiry?.email || '',
    phone: enquiry?.phone || '',
    message: enquiry?.message || '',
    status: enquiry?.status || 'New',
    date: enquiry?.date || normalizeDate(enquiry?.createdAt, ''),
  };
}

export function readCachedEnquiries() {
  return readJson(ENQUIRIES_CACHE_KEY, []).map(normalizeEnquiryRecord);
}

export function writeCachedEnquiries(enquiries) {
  cacheLocalSnapshot(ENQUIRIES_CACHE_KEY, enquiries);
}

export async function syncEnquiriesCache() {
  const payload = await apiFetch('/api/enquiries');
  const enquiries = (payload?.data || []).map(normalizeEnquiryRecord);
  writeCachedEnquiries(enquiries);
  return enquiries;
}

export async function createEnquiryRecord(enquiry) {
  const payload = await apiFetch('/api/enquiries', {
    method: 'POST',
    body: enquiry,
  });
  return normalizeEnquiryRecord(payload?.data);
}

export async function updateEnquiryRecord(id, enquiry) {
  const payload = await apiFetch(`/api/enquiries/${id}`, {
    method: 'PUT',
    body: enquiry,
  });
  return normalizeEnquiryRecord(payload?.data);
}

export async function deleteEnquiryRecord(id) {
  await apiFetch(`/api/enquiries/${id}`, { method: 'DELETE' });
}
