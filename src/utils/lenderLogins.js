import { getApiUrl } from './api';

const STORAGE_KEY = 'lender_logins';

const seedLogins = [
  {
    _id: 'demo-1',
    lenderId: 1,
    leadName: 'Acme Enterprises',
    surrogate: 'Ramesh',
    loginDate: '2026-02-10',
    status: 'Done',
    remarks: 'Successful',
    product: 'business',
  },
  {
    _id: 'demo-2',
    lenderId: 1,
    leadName: 'Bright Solutions',
    surrogate: 'Suresh',
    loginDate: '2026-02-09',
    status: 'Done',
    remarks: 'Successful',
    product: 'business',
  },
  {
    _id: 'demo-3',
    lenderId: 1,
    leadName: 'Comfy Retail',
    surrogate: 'Anita',
    loginDate: '2026-02-08',
    status: 'Failed',
    remarks: 'Invalid docs',
    product: 'home',
  },
  {
    _id: 'demo-4',
    lenderId: 2,
    leadName: 'Metro Trading Co.',
    surrogate: 'Pooja',
    loginDate: '2026-02-11',
    status: 'Done',
    remarks: 'Income proof verified',
    product: 'business',
  },
  {
    _id: 'demo-5',
    lenderId: 2,
    leadName: 'Sunrise Developers',
    surrogate: 'Kiran',
    loginDate: '2026-02-07',
    status: 'In Review',
    remarks: 'Waiting for bank statement',
    product: 'home',
  },
];

function readStoredLogins() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (error) {
    return [];
  }
}

function persistLogins(logins) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(logins));
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('app:storage-changed', { detail: { key: STORAGE_KEY } }));
    }
  } catch (error) {
    // Ignore storage failures and keep the demo usable.
  }
}

function ensureSeedLogins() {
  const existing = readStoredLogins();
  if (existing.length === 0) {
    persistLogins(seedLogins);
    return seedLogins;
  }
  return existing;
}

function normalizeLogin(item, lenderId, index) {
  return {
    _id: item?._id || `login-${lenderId}-${index}`,
    lenderId: Number(item?.lenderId ?? item?.metadata?.legacyLenderId ?? lenderId),
    leadName: item?.leadName || '',
    surrogate: item?.surrogate || '',
    loginDate: item?.loginDate || '',
    status: item?.status || 'Pending',
    remarks: item?.remarks || '',
    product: item?.product || 'business',
  };
}

export function getAllStoredLenderLogins() {
  return ensureSeedLogins()
    .slice()
    .sort((a, b) => new Date(b.loginDate) - new Date(a.loginDate));
}

export function getStoredLenderLogins(lenderId) {
  const allLogins = getAllStoredLenderLogins();
  return allLogins
    .filter((item) => String(item.lenderId) === String(lenderId))
    .sort((a, b) => new Date(b.loginDate) - new Date(a.loginDate));
}

async function parseJsonSafely(response) {
  const text = await response.text();
  if (!text) {
    return null;
  }

  try {
    return JSON.parse(text);
  } catch (error) {
    const firstLine = text.split('\n')[0].trim();
    throw new Error(firstLine || 'Received a non-JSON response from the server.');
  }
}

export async function fetchLenderLogins(lenderId) {
  const fallbackData = getStoredLenderLogins(lenderId);

  try {
    const response = await fetch(getApiUrl(`/api/lenders/${lenderId}/logins`));
    const payload = await parseJsonSafely(response);

    if (!response.ok) {
      throw new Error(payload?.message || `Request failed with status ${response.status}`);
    }

    if (!payload?.success || !Array.isArray(payload.data)) {
      throw new Error(payload?.message || 'Unexpected lender logins response.');
    }

    const normalized = payload.data.map((item, index) => normalizeLogin(item, lenderId, index));
    const remaining = ensureSeedLogins().filter((item) => String(item.lenderId) !== String(lenderId));
    persistLogins([...remaining, ...normalized]);

    return { data: normalized, warning: '' };
  } catch (error) {
    return {
      data: fallbackData,
      warning: fallbackData.length
        ? 'Live lender logins are unavailable right now. Showing saved/demo data instead.'
        : 'Live lender logins are unavailable right now and no saved demo data was found.',
    };
  }
}
