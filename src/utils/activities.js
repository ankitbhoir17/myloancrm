// Simple activity logging utility using localStorage
const ACTIVITIES_KEY = 'app_activities';

export function getActivities() {
  try {
    const raw = localStorage.getItem(ACTIVITIES_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    return [];
  }
}

export function addActivity({ type, actor = 'system', message = '', meta = {} }) {
  try {
    const activities = getActivities();
    const id = activities.length ? Math.max(...activities.map(a => a.id)) + 1 : 1;
    const item = {
      id,
      type,
      actor,
      message,
      meta,
      read: false,
      date: new Date().toISOString()
    };
    const next = [item, ...activities];
    localStorage.setItem(ACTIVITIES_KEY, JSON.stringify(next));
    // Dispatch storage event to notify other tabs/components (also listen to custom event optionally)
    window.dispatchEvent(new Event('activities:changed'));
    return item;
  } catch (e) {
    console.error('Failed to add activity', e);
    return null;
  }
}

export function markActivityRead(id) {
  try {
    const activities = getActivities();
    const next = activities.map(a => a.id === id ? { ...a, read: true } : a);
    localStorage.setItem(ACTIVITIES_KEY, JSON.stringify(next));
    window.dispatchEvent(new Event('activities:changed'));
    return true;
  } catch (e) {
    return false;
  }
}

export function markAllRead() {
  try {
    const activities = getActivities();
    const next = activities.map(a => ({ ...a, read: true }));
    localStorage.setItem(ACTIVITIES_KEY, JSON.stringify(next));
    window.dispatchEvent(new Event('activities:changed'));
    return true;
  } catch (e) {
    return false;
  }
}

export function clearActivities() {
  try {
    localStorage.removeItem(ACTIVITIES_KEY);
    window.dispatchEvent(new Event('activities:changed'));
    return true;
  } catch (e) {
    return false;
  }
}

export function removeActivity(id) {
  try {
    const activities = getActivities();
    const next = activities.filter(a => a.id !== id);
    localStorage.setItem(ACTIVITIES_KEY, JSON.stringify(next));
    window.dispatchEvent(new Event('activities:changed'));
    return true;
  } catch (e) {
    return false;
  }
}

export default { getActivities, addActivity, markActivityRead, markAllRead, clearActivities };
