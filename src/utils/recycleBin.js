const RECYCLE_BIN_KEY = 'app_recycle_bin';

export const RECYCLE_ENTITY_CONFIG = {
  loans: { label: 'Loan', storageKey: 'loans', section: 'loans' },
  customers: { label: 'Customer', storageKey: 'customers', section: 'customers' },
  enquiries: { label: 'Enquiry', storageKey: 'enquiries', section: 'data' },
  leads: { label: 'Lead', storageKey: 'leads', section: 'data' },
  users: { label: 'User', storageKey: 'app_users', section: 'data' },
};

function readJson(key, fallback = []) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch (error) {
    return fallback;
  }
}

function writeJson(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

function dispatch(name, detail = null) {
  if (typeof window === 'undefined') {
    return;
  }

  if (detail) {
    window.dispatchEvent(new CustomEvent(name, { detail }));
    return;
  }

  window.dispatchEvent(new Event(name));
}

function asNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function buildTitle(entityType, item) {
  switch (entityType) {
    case 'loans':
      return `Loan #${String(item?.id ?? '').padStart(4, '0')}`;
    case 'customers':
      return item?.name || `Customer #${item?.id ?? ''}`;
    case 'enquiries':
      return item?.customerName || `Enquiry #${item?.id ?? ''}`;
    case 'leads':
      return item?.businessName || `Lead #${String(item?.id ?? '').padStart(3, '0')}`;
    case 'users':
      return item?.name || item?.username || `User #${item?.id ?? ''}`;
    default:
      return `Record #${item?.id ?? ''}`;
  }
}

function buildSubtitle(entityType, item) {
  switch (entityType) {
    case 'loans':
      return [
        item?.customer || 'No customer',
        item?.lenderName || 'No lender',
        `Rs. ${Number(item?.amount || 0).toLocaleString()}`,
      ].join(' • ');
    case 'customers':
      return [item?.email || 'No email', item?.phone || 'No phone'].join(' • ');
    case 'enquiries':
      return [item?.email || 'No email', item?.phone || 'No phone', item?.status || 'New'].join(' • ');
    case 'leads':
      return [item?.contactPerson || 'No contact', item?.primaryPhone || 'No phone', item?.loanType || 'Lead'].join(' • ');
    case 'users':
      return [item?.username || 'No username', item?.email || 'No email', item?.role || 'user'].join(' • ');
    default:
      return '';
  }
}

function persistCollection(storageKey, items) {
  writeJson(storageKey, items);
  dispatch('app:storage-changed', { key: storageKey });

  if (storageKey === 'app_users') {
    dispatch('auth:changed');
  }

  if (storageKey === 'app_activities') {
    dispatch('activities:changed');
  }
}

export function getRecycleBinItems() {
  const items = readJson(RECYCLE_BIN_KEY, []);
  return Array.isArray(items) ? items : [];
}

export function addToRecycleBin({ entityType, item, title, subtitle }) {
  const config = RECYCLE_ENTITY_CONFIG[entityType];
  if (!config || !item) {
    return null;
  }

  const existing = getRecycleBinItems();
  const nextEntryId = existing.length
    ? Math.max(...existing.map((entry) => asNumber(entry.entryId))) + 1
    : 1;

  const nextEntry = {
    entryId: nextEntryId,
    entityType,
    section: config.section,
    storageKey: config.storageKey,
    recordId: item.id ?? null,
    title: title || buildTitle(entityType, item),
    subtitle: subtitle || buildSubtitle(entityType, item),
    item,
    deletedAt: new Date().toISOString(),
  };

  const nextItems = [
    nextEntry,
    ...existing.filter((entry) => !(entry.entityType === entityType && entry.recordId === nextEntry.recordId)),
  ];

  writeJson(RECYCLE_BIN_KEY, nextItems);
  dispatch('recyclebin:changed');
  return nextEntry;
}

export function restoreRecycleBinItem(entryId) {
  const items = getRecycleBinItems();
  const target = items.find((entry) => entry.entryId === entryId);

  if (!target) {
    return { success: false, reason: 'not_found' };
  }

  const activeItems = readJson(target.storageKey, []);
  const currentItems = Array.isArray(activeItems) ? activeItems : [];
  const hasConflict = currentItems.some((item) => item.id === target.recordId);
  if (hasConflict) {
    return { success: false, reason: 'conflict', entry: target };
  }

  persistCollection(target.storageKey, [target.item, ...currentItems]);
  writeJson(RECYCLE_BIN_KEY, items.filter((entry) => entry.entryId !== entryId));
  dispatch('recyclebin:changed');
  return { success: true, entry: target, item: target.item };
}

export function deleteRecycleBinItem(entryId) {
  const items = getRecycleBinItems();
  const target = items.find((entry) => entry.entryId === entryId);
  if (!target) {
    return null;
  }

  writeJson(RECYCLE_BIN_KEY, items.filter((entry) => entry.entryId !== entryId));
  dispatch('recyclebin:changed');
  return target;
}

export function getNextEntityId(entityType, activeItems = null) {
  const config = RECYCLE_ENTITY_CONFIG[entityType];
  if (!config) {
    return 1;
  }

  const currentItems = Array.isArray(activeItems) ? activeItems : readJson(config.storageKey, []);
  const safeItems = Array.isArray(currentItems) ? currentItems : [];
  const deletedItems = getRecycleBinItems().filter((entry) => entry.entityType === entityType);
  const highestActiveId = safeItems.length ? Math.max(...safeItems.map((item) => asNumber(item.id))) : 0;
  const highestDeletedId = deletedItems.length ? Math.max(...deletedItems.map((entry) => asNumber(entry.recordId))) : 0;

  return Math.max(highestActiveId, highestDeletedId) + 1;
}
