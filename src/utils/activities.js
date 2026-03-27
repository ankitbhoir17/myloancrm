import { apiFetch, cacheLocalSnapshot } from './api';

const ACTIVITIES_KEY = 'app_activities';

function dispatchActivitiesChanged() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event('activities:changed'));
  }
}

function normalizeActivity(activity) {
  return {
    id: activity?._id || activity?.id || '',
    type: activity?.type || 'general',
    actor: activity?.actor || 'system',
    message: activity?.message || activity?.note || '',
    meta: activity?.meta || activity?.metadata || {},
    read: Boolean(activity?.read),
    date: activity?.date || activity?.createdAt || new Date().toISOString(),
    createdAt: activity?.createdAt || activity?.date || '',
    updatedAt: activity?.updatedAt || '',
  };
}

function writeActivities(activities) {
  cacheLocalSnapshot(ACTIVITIES_KEY, activities);
  dispatchActivitiesChanged();
}

export function getActivities() {
  try {
    const raw = localStorage.getItem(ACTIVITIES_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.map(normalizeActivity) : [];
  } catch (error) {
    return [];
  }
}

export async function syncActivities() {
  const payload = await apiFetch('/api/activities');
  const activities = Array.isArray(payload?.data) ? payload.data.map(normalizeActivity) : [];
  writeActivities(activities);
  return activities;
}

export async function addActivity({ type, actor = 'system', message = '', meta = {} }) {
  try {
    const payload = await apiFetch('/api/activities', {
      method: 'POST',
      body: { type, actor, message, meta },
    });

    const activity = normalizeActivity(payload?.data);
    const next = [activity, ...getActivities().filter((item) => item.id !== activity.id)];
    writeActivities(next);
    return activity;
  } catch (error) {
    console.error('Failed to add activity', error);
    return null;
  }
}

export async function markActivityRead(id) {
  try {
    const payload = await apiFetch(`/api/activities/${id}`, {
      method: 'PUT',
      body: { read: true },
    });

    const updated = normalizeActivity(payload?.data);
    const next = getActivities().map((item) => (item.id === id ? updated : item));
    writeActivities(next);
    return true;
  } catch (error) {
    return false;
  }
}

export async function markAllRead() {
  try {
    const payload = await apiFetch('/api/activities/mark-all-read', { method: 'PATCH' });
    const activities = Array.isArray(payload?.data) ? payload.data.map(normalizeActivity) : [];
    writeActivities(activities);
    return true;
  } catch (error) {
    return false;
  }
}

export async function clearActivities() {
  try {
    await apiFetch('/api/activities', { method: 'DELETE' });
    writeActivities([]);
    return true;
  } catch (error) {
    return false;
  }
}

export async function removeActivity(id) {
  try {
    await apiFetch(`/api/activities/${id}`, { method: 'DELETE' });
    const next = getActivities().filter((item) => item.id !== id);
    writeActivities(next);
    return true;
  } catch (error) {
    return false;
  }
}

export default { getActivities, syncActivities, addActivity, markActivityRead, markAllRead, clearActivities };
