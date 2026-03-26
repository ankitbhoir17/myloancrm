import { apiFetch, cacheLocalSnapshot } from './api';
import {
  createCustomerRecord,
  createLoanRecord,
  syncCustomersCache,
  syncLoansCache,
} from './crmData';
import {
  createEnquiryRecord,
  syncEnquiriesCache,
} from './enquiriesData';
import {
  createLeadRecord,
  syncLeadsCache,
} from './leadsData';
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

function withRestoreId(item, recordId) {
  if (/^[0-9a-fA-F]{24}$/.test(String(recordId || ''))) {
    return {
      ...item,
      _id: recordId,
    };
  }

  return item;
}

export async function restoreDeletedEntry(entry, options = {}) {
  if (!entry) {
    throw new Error('Recycle bin entry not found.');
  }

  switch (entry.entityType) {
    case 'customers': {
      const restoredCustomer = await createCustomerRecord(withRestoreId(entry.item, entry.recordId));
      await syncCustomersCache();
      deleteRecycleBinItem(entry.entryId);
      return restoredCustomer;
    }

    case 'loans': {
      const restoredLoan = await createLoanRecord(withRestoreId(entry.item, entry.recordId));
      await syncLoansCache();
      deleteRecycleBinItem(entry.entryId);
      return restoredLoan;
    }

    case 'enquiries': {
      const restoredEnquiry = await createEnquiryRecord(withRestoreId(entry.item, entry.recordId));
      await syncEnquiriesCache();
      deleteRecycleBinItem(entry.entryId);
      return restoredEnquiry;
    }

    case 'leads': {
      const restoredLead = await createLeadRecord(withRestoreId(entry.item, entry.recordId));
      await syncLeadsCache();
      deleteRecycleBinItem(entry.entryId);
      return restoredLead;
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
