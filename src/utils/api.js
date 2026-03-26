const API_BASE_URL = (process.env.REACT_APP_API_BASE_URL || '').replace(/\/+$/, '');

export const AUTH_TOKEN_KEY = 'auth_token';
export const AUTH_USER_KEY = 'auth_user';
const CLIENT_CACHE_KEYS = [
  'customers',
  'loans',
  'enquiries',
  'leads',
  'lenders',
  'lender_logins',
  'app_users',
  'app_recycle_bin',
  'app_activities',
];

function dispatchAuthChanged() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event('auth:changed'));
  }
}

function dispatchStorageChanged(key) {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('app:storage-changed', { detail: { key } }));
  }
}

export function getApiUrl(path) {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return API_BASE_URL ? `${API_BASE_URL}${normalizedPath}` : normalizedPath;
}

export function readStoredAuthToken() {
  try {
    return localStorage.getItem(AUTH_TOKEN_KEY) || '';
  } catch (error) {
    return '';
  }
}

export function readStoredAuthUser() {
  try {
    const raw = localStorage.getItem(AUTH_USER_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (error) {
    return null;
  }
}

export function saveAuthSession({ token, user }) {
  try {
    if (typeof token === 'string') {
      localStorage.setItem(AUTH_TOKEN_KEY, token);
    }

    if (user) {
      localStorage.setItem(AUTH_USER_KEY, JSON.stringify(user));
    }

    localStorage.removeItem('user');
    dispatchAuthChanged();
  } catch (error) {
    // Ignore storage failures and keep the API response available to callers.
  }
}

export function updateStoredAuthUser(user) {
  try {
    if (user) {
      localStorage.setItem(AUTH_USER_KEY, JSON.stringify(user));
    } else {
      localStorage.removeItem(AUTH_USER_KEY);
    }

    dispatchAuthChanged();
  } catch (error) {
    // Ignore storage failures and keep the UI usable.
  }
}

export function clearAuthSession() {
  try {
    localStorage.removeItem(AUTH_TOKEN_KEY);
    localStorage.removeItem(AUTH_USER_KEY);
    localStorage.removeItem('user');
    CLIENT_CACHE_KEYS.forEach((key) => {
      localStorage.removeItem(key);
      dispatchStorageChanged(key);
    });
    dispatchAuthChanged();
  } catch (error) {
    // Ignore storage failures and keep the UI usable.
  }
}

export function cacheLocalSnapshot(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    dispatchStorageChanged(key);
  } catch (error) {
    // Ignore storage failures and keep the UI usable.
  }
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

export async function apiFetch(path, options = {}) {
  const {
    token = undefined,
    body,
    headers: rawHeaders,
    ...rest
  } = options;

  const headers = new Headers(rawHeaders || {});
  const resolvedToken = token === undefined ? readStoredAuthToken() : token;
  const hasBody = body !== undefined && body !== null;
  const isJsonBody = hasBody && !(body instanceof FormData);

  if (resolvedToken && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${resolvedToken}`);
  }

  if (isJsonBody && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  const response = await fetch(getApiUrl(path), {
    ...rest,
    headers,
    body: isJsonBody ? JSON.stringify(body) : body,
  });

  const payload = await parseJsonSafely(response);
  if (!response.ok) {
    const error = new Error(
      payload?.message ||
      payload?.error ||
      `Request failed with status ${response.status}`
    );
    error.status = response.status;
    error.payload = payload;
    throw error;
  }

  return payload;
}
