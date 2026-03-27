import React, { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { addActivity } from '../utils/activities';
import {
  deleteRecycleBinItem,
  getRecycleBinItems,
} from '../utils/recycleBin';
import { restoreDeletedEntry } from '../utils/recycleBinApi';
import './Customers.css';
import './RecycleBin.css';

const SECTION_META = {
  loans: { title: 'Deleted Loans', empty: 'No deleted loans right now.' },
  customers: { title: 'Deleted Customers', empty: 'No deleted customers right now.' },
  data: { title: 'Deleted Data', empty: 'No deleted data right now.' },
};

const TYPE_LABELS = {
  loans: 'Loan',
  customers: 'Customer',
  enquiries: 'Enquiry',
  leads: 'Lead',
  users: 'User',
};

function getSection(entry) {
  return entry?.section || 'data';
}

function formatDate(value) {
  if (!value) {
    return '-';
  }

  try {
    return new Date(value).toLocaleString();
  } catch (error) {
    return value;
  }
}

function matchesSearch(entry, query) {
  if (!query) {
    return true;
  }

  const haystack = [
    entry.title,
    entry.subtitle,
    TYPE_LABELS[entry.entityType],
    entry.item?.customer,
    entry.item?.name,
    entry.item?.customerName,
    entry.item?.businessName,
    entry.item?.username,
    entry.item?.email,
    entry.item?.phone,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  return haystack.includes(query);
}

function RecycleBin() {
  const { user } = useAuth();
  const [items, setItems] = useState(() => getRecycleBinItems());
  const [search, setSearch] = useState('');
  const [sectionFilter, setSectionFilter] = useState('all');
  const [message, setMessage] = useState('');

  useEffect(() => {
    const sync = () => setItems(getRecycleBinItems());

    window.addEventListener('recyclebin:changed', sync);
    window.addEventListener('storage', sync);

    return () => {
      window.removeEventListener('recyclebin:changed', sync);
      window.removeEventListener('storage', sync);
    };
  }, []);

  if (!user || user.role !== 'superuser') {
    return (
      <div className="customers-page recycle-page">
        <div className="page-header">
          <div>
            <h1>Recycle Bin</h1>
          </div>
        </div>
        <p>Access denied. Superuser only.</p>
      </div>
    );
  }

  const counts = useMemo(() => items.reduce((acc, entry) => {
    const section = getSection(entry);
    acc.all += 1;
    if (acc[section] != null) {
      acc[section] += 1;
    }
    return acc;
  }, { all: 0, loans: 0, customers: 0, data: 0 }), [items]);

  const filteredItems = useMemo(() => {
    const normalizedQuery = search.trim().toLowerCase();
    return items.filter((entry) => {
      const matchesSection = sectionFilter === 'all' || getSection(entry) === sectionFilter;
      return matchesSection && matchesSearch(entry, normalizedQuery);
    });
  }, [items, search, sectionFilter]);

  const groupedItems = useMemo(() => filteredItems.reduce((acc, entry) => {
    const section = getSection(entry);
    if (!acc[section]) {
      acc[section] = [];
    }
    acc[section].push(entry);
    return acc;
  }, { loans: [], customers: [], data: [] }), [filteredItems]);

  const sectionsToRender = sectionFilter === 'all' ? ['loans', 'customers', 'data'] : [sectionFilter];

  const handleRestore = (entry) => {
    const restoreRecord = async () => {
      try {
        const password = entry.entityType === 'users'
          ? prompt(`Enter a new password for ${entry.title}:`, 'password123')
          : null;

        if (entry.entityType === 'users' && password === null) {
          return;
        }

        await restoreDeletedEntry(entry, { password });
        setMessage(`${entry.title} restored successfully.`);

        try {
          addActivity({
            type: 'recycle_bin_restored',
            actor: user?.username || 'system',
            message: `${entry.title} restored from recycle bin`,
            meta: { entityType: entry.entityType, recordId: entry.recordId },
          });
        } catch (error) {
          // Ignore activity failures.
        }
      } catch (error) {
        setMessage(error.message || `${entry.title} could not be restored.`);
      }
    };

    restoreRecord();
  };

  const handleDeleteForever = (entry) => {
    if (!window.confirm(`Delete ${entry.title} permanently from the recycle bin?`)) {
      return;
    }

    const removed = deleteRecycleBinItem(entry.entryId);
    if (!removed) {
      return;
    }

    setMessage(`${entry.title} permanently removed.`);

    try {
      addActivity({
        type: 'recycle_bin_deleted_forever',
        actor: user?.username || 'system',
        message: `${entry.title} permanently removed from recycle bin`,
        meta: { entityType: entry.entityType, recordId: entry.recordId },
      });
    } catch (error) {
      // Ignore activity failures.
    }
  };

  return (
    <div className="customers-page recycle-page">
      <div className="page-header">
        <div>
          <h1>Recycle Bin</h1>
          <p className="recycle-subtitle">Restore deleted loans, customers, and other saved CRM data from here.</p>
        </div>
      </div>

      <div className="recycle-summary-grid">
        <div className="recycle-summary-card">
          <span className="recycle-summary-label">Deleted Loans</span>
          <strong>{counts.loans}</strong>
        </div>
        <div className="recycle-summary-card">
          <span className="recycle-summary-label">Deleted Customers</span>
          <strong>{counts.customers}</strong>
        </div>
        <div className="recycle-summary-card">
          <span className="recycle-summary-label">Deleted Data</span>
          <strong>{counts.data}</strong>
        </div>
      </div>

      <div className="filters recycle-filters">
        <input
          type="text"
          className="search-input"
          placeholder="Search deleted records..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select
          className="filter-select"
          value={sectionFilter}
          onChange={(e) => setSectionFilter(e.target.value)}
        >
          <option value="all">All Sections</option>
          <option value="loans">Deleted Loans</option>
          <option value="customers">Deleted Customers</option>
          <option value="data">Deleted Data</option>
        </select>
      </div>

      {message ? <div className="recycle-banner">{message}</div> : null}

      {sectionsToRender.map((sectionKey) => (
        <section key={sectionKey} className="customer-card full-width recycle-section-card">
          <div className="recycle-section-header">
            <h2>{SECTION_META[sectionKey].title}</h2>
            <span className="muted">{groupedItems[sectionKey].length} items</span>
          </div>

          {groupedItems[sectionKey].length === 0 ? (
            <p className="muted recycle-empty">{SECTION_META[sectionKey].empty}</p>
          ) : (
            <div className="recycle-list">
              {groupedItems[sectionKey].map((entry) => (
                <div key={entry.entryId} className="recycle-item">
                  <div className="recycle-item-main">
                    <div className="recycle-item-top">
                      <h3>{entry.title}</h3>
                      <span className="recycle-type-badge">{TYPE_LABELS[entry.entityType] || 'Record'}</span>
                    </div>
                    <p>{entry.subtitle || 'No extra details available.'}</p>
                    <div className="recycle-meta">
                      <span>Deleted: {formatDate(entry.deletedAt)}</span>
                      <span>Record ID: {entry.recordId ?? '-'}</span>
                    </div>
                  </div>
                  <div className="recycle-actions">
                    <button type="button" className="btn-primary" onClick={() => handleRestore(entry)}>
                      Restore
                    </button>
                    <button type="button" className="btn-danger" onClick={() => handleDeleteForever(entry)}>
                      Delete Forever
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      ))}
    </div>
  );
}

export default RecycleBin;
