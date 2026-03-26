import { apiFetch, cacheLocalSnapshot } from './api';

const STORAGE_KEY = 'lender_logins';

function readStoredLogins() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (error) {
    return [];
  }
}

function persistLogins(logins) {
  cacheLocalSnapshot(STORAGE_KEY, logins);
}

function normalizeLogin(item, lenderId, index) {
  return {
    _id: item?._id || `login-${lenderId}-${index}`,
    lenderId: String(item?.lenderId ?? item?.lender ?? item?.metadata?.legacyLenderId ?? lenderId),
    leadName: item?.leadName || '',
    surrogate: item?.surrogate || '',
    loginDate: item?.loginDate || '',
    status: item?.status || 'Pending',
    remarks: item?.remarks || '',
    product: item?.product || 'business',
  };
}

export function getAllStoredLenderLogins() {
  return readStoredLogins()
    .map((item, index) => normalizeLogin(item, item?.lenderId || item?.lender || 'unknown', index))
    .slice()
    .sort((a, b) => new Date(b.loginDate) - new Date(a.loginDate));
}

export function getStoredLenderLogins(lenderId) {
  const allLogins = getAllStoredLenderLogins();
  return allLogins
    .filter((item) => String(item.lenderId) === String(lenderId))
    .sort((a, b) => new Date(b.loginDate) - new Date(a.loginDate));
}

export async function fetchLenderLogins(lenderId) {
  const fallbackData = getStoredLenderLogins(lenderId);

  try {
    const payload = await apiFetch(`/api/lenders/${lenderId}/logins`);
    if (!payload?.success || !Array.isArray(payload.data)) {
      throw new Error(payload?.message || 'Unexpected lender logins response.');
    }

    const normalized = payload.data.map((item, index) => normalizeLogin(item, lenderId, index));
    const remaining = getAllStoredLenderLogins().filter((item) => String(item.lenderId) !== String(lenderId));
    persistLogins([...remaining, ...normalized]);

    return { data: normalized, warning: '' };
  } catch (error) {
    if (fallbackData.length > 0 && Number(error?.status || 0) >= 500) {
      return {
        data: fallbackData,
        warning: 'Live lender logins are unavailable right now. Showing the latest cached logins instead.',
      };
    }

    throw error;
  }
}
