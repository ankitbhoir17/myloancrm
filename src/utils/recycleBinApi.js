import { apiFetch, cacheLocalSnapshot } from './api';
import {
  createCustomerRecord,
  createLoanRecord,
  syncCustomersCache,
  syncLoansCache,
} from './crmData';
import { deleteRecycleBinItem, restoreRecycleBinItem } from './recycleBin';

function normalizeUserSnapshot(user) {
  return {
    id: user._id || user.id,
    username: user.username,
    name: user.name,
    role: user.role,
    email: user.email,
    isActive: user.isActive,
    passwordSet: true,
  };
}

export async function restoreDeletedEntry(entry, options = {}) {
  if (!entry) {
    throw new Error('Recycle bin entry not found.');
  }

  switch (entry.entityType) {
    case 'customers': {
      const restoredCustomer = await createCustomerRecord({
        ...entry.item,
        _id: entry.recordId,
      });
      await syncCustomersCache();
      deleteRecycleBinItem(entry.entryId);
      return restoredCustomer;
    }

    case 'loans': {
      const restoredLoan = await createLoanRecord({
        ...entry.item,
        _id: entry.recordId,
      });
      await syncLoansCache();
      deleteRecycleBinItem(entry.entryId);
      return restoredLoan;
    }

    case 'users': {
      const password = String(options.password || '').trim();
      if (!password) {
        throw new Error('A new password is required to restore this user.');
      }

      await apiFetch('/api/users', {
        method: 'POST',
        body: {
          ...entry.item,
          _id: entry.recordId,
          password,
        },
      });

      const usersPayload = await apiFetch('/api/users');
      const userSnapshots = (usersPayload?.data || []).map(normalizeUserSnapshot);
      cacheLocalSnapshot('app_users', userSnapshots);
      deleteRecycleBinItem(entry.entryId);
      return userSnapshots.find((item) => String(item.id) === String(entry.recordId)) || null;
    }

    default: {
      const result = restoreRecycleBinItem(entry.entryId);
      if (!result.success) {
        throw new Error('This record could not be restored.');
      }
      return result.item;
    }
  }
}
