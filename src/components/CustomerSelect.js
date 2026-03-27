import React, { useEffect, useRef, useState } from 'react';
import { readCachedCustomers, syncCustomersCache } from '../utils/crmData';
import './CustomerSelect.css';

// CustomerSelect - richer autocomplete
// Props:
// - mode: 'input' | 'select' (default 'input')
// - valueId: string|null
// - valueName: string
// - onChange: ({ customerId, customerName }) => void
// - placeholder, required

function formatCustomerLabel(id) {
  const value = String(id || '').trim();
  if (!value) {
    return '#-';
  }

  return `#${value.length > 6 ? value.slice(-6) : value}`;
}

function CustomerSelect({
  mode = 'input',
  valueId = '',
  valueName = '',
  onChange = () => {},
  placeholder = '',
  required = false,
}) {
  const [customers, setCustomers] = useState([]);
  const [query, setQuery] = useState(valueName || '');
  const [open, setOpen] = useState(false);
  const [results, setResults] = useState([]);
  const [highlight, setHighlight] = useState(0);
  const rootRef = useRef(null);

  useEffect(() => {
    let isMounted = true;

    const syncFromCache = () => {
      if (isMounted) {
        setCustomers(readCachedCustomers());
      }
    };

    const ensureCustomers = async () => {
      syncFromCache();
      if (readCachedCustomers().length === 0) {
        try {
          await syncCustomersCache();
          syncFromCache();
        } catch (error) {
          // Keep the selector usable with whatever cache is already available.
        }
      }
    };

    ensureCustomers();

    window.addEventListener('storage', syncFromCache);
    window.addEventListener('app:storage-changed', syncFromCache);

    return () => {
      isMounted = false;
      window.removeEventListener('storage', syncFromCache);
      window.removeEventListener('app:storage-changed', syncFromCache);
    };
  }, []);

  useEffect(() => {
    setQuery(valueName || '');
  }, [valueName]);

  useEffect(() => {
    if (!query) {
      setResults(customers.slice(0, 8));
      return;
    }

    const q = query.trim().toLowerCase();
    const matched = customers
      .map((customer) => ({
        score: scoreMatch(customer, q),
        item: customer,
      }))
      .filter((result) => result.score > 0)
      .sort((a, b) => b.score - a.score)
      .map((result) => result.item)
      .slice(0, 8);

    setResults(matched);
  }, [query, customers]);

  useEffect(() => {
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery || !customers.length) {
      return;
    }

    const exactMatch = customers.find(
      (customer) => (customer.name || '').trim().toLowerCase() === normalizedQuery
    );

    if (!exactMatch) {
      return;
    }

    if (String(valueId || '') === String(exactMatch.id)) {
      return;
    }

    onChange({
      customerId: String(exactMatch.id),
      customerName: exactMatch.name,
    });
  }, [customers, onChange, query, valueId]);

  useEffect(() => {
    function onDocClick(event) {
      if (!rootRef.current) {
        return;
      }

      if (!rootRef.current.contains(event.target)) {
        setOpen(false);
      }
    }

    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, []);

  function findCustomerById(id) {
    return customers.find((customer) => String(customer.id) === String(id));
  }

  function scoreMatch(customer, q) {
    if (!q) {
      return 1;
    }

    const name = (customer.name || '').toLowerCase();
    const email = (customer.email || '').toLowerCase();
    const id = String(customer.id || '').toLowerCase();
    let score = 0;

    if (name === q) {
      score += 100;
    }
    if (name.includes(q)) {
      score += 50 - name.indexOf(q);
    }
    if (email.includes(q)) {
      score += 30;
    }
    if (id === q) {
      score += 80;
    }

    return score;
  }

  const selectItem = (customer) => {
    setQuery(customer.name || '');
    setOpen(false);
    onChange({ customerId: String(customer.id), customerName: customer.name });
  };

  const handleInput = (event) => {
    const value = event.target.value;
    setQuery(value);
    setOpen(true);

    const matched = customers.find(
      (customer) => customer.name && customer.name.trim().toLowerCase() === value.trim().toLowerCase()
    );

    if (matched) {
      onChange({ customerId: String(matched.id), customerName: matched.name });
    } else {
      onChange({ customerId: '', customerName: value });
    }
  };

  const handleKeyDown = (event) => {
    if (!open) {
      return;
    }

    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setHighlight((index) => Math.min(index + 1, results.length - 1));
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setHighlight((index) => Math.max(index - 1, 0));
    } else if (event.key === 'Enter') {
      event.preventDefault();
      const selected = results[highlight];
      if (selected) {
        selectItem(selected);
      }
    } else if (event.key === 'Escape') {
      setOpen(false);
    }
  };

  if (mode === 'select') {
    return (
      <div className="customer-select-root" ref={rootRef}>
        <button type="button" className="customer-select-trigger" onClick={() => setOpen((current) => !current)}>
          {valueId ? findCustomerById(valueId)?.name || 'Select customer' : (valueName || 'Select customer')}
        </button>
        {open ? (
          <ul className="customer-suggestions list-mode">
            <li className="suggestion-item suggestion-header">ID / Name / Email</li>
            {customers.length === 0 ? <li className="suggestion-empty">No customers</li> : null}
            {customers.map((customer) => (
              <li key={customer.id} className="suggestion-item" onClick={() => selectItem(customer)}>
                <div className="s-left">{formatCustomerLabel(customer.id)}</div>
                <div className="s-main">{customer.name}</div>
                <div className="s-meta">{customer.email || '-'}</div>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    );
  }

  return (
    <div className="customer-select-root" ref={rootRef}>
      <input
        type="text"
        placeholder={placeholder}
        value={query}
        onChange={handleInput}
        onFocus={() => setOpen(true)}
        onKeyDown={handleKeyDown}
        aria-autocomplete="list"
        required={required}
      />
      {open ? (
        <ul className="customer-suggestions" role="listbox">
          {results.length === 0 ? (
            <li className="suggestion-empty">No matches</li>
          ) : (
            results.map((customer, index) => (
              <li
                key={customer.id}
                className={`suggestion-item ${index === highlight ? 'highlight' : ''}`}
                onMouseDown={(event) => {
                  event.preventDefault();
                  selectItem(customer);
                }}
                role="option"
                aria-selected={index === highlight}
              >
                <div className="s-left">{formatCustomerLabel(customer.id)}</div>
                <div className="s-main">
                  <div className="s-name">{customer.name}</div>
                  <div className="s-email">{customer.email}</div>
                </div>
                <div className="s-meta">{customer.phone || ''}</div>
              </li>
            ))
          )}
        </ul>
      ) : null}
    </div>
  );
}

export default CustomerSelect;
