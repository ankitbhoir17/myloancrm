import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import './Lenders.css';
import { fetchLenderLogins } from '../utils/lenderLogins';
import { LOAN_STATUS_FLOW } from '../utils/loanWorkflow';
import {
  buildLenderInsight,
  formatCurrency,
  mergeLendersWithFlow,
  normalizeLenderName,
  readStoredLoans,
} from '../utils/lenderFlow';
import {
  createLenderRecord,
  readCachedLenders,
  syncLendersCache,
  updateLenderRecord,
} from '../utils/lendersData';
import {
  updateLoanRecord,
  writeCachedLoans,
} from '../utils/crmData';

function formatDate(value) {
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? '-' : parsed.toLocaleDateString();
}

function getLenderStatusClass(status) {
  switch (String(status || '').toLowerCase()) {
    case 'active':
      return 'lender-status status-active';
    case 'inactive':
      return 'lender-status status-inactive';
    default:
      return 'lender-status status-new';
  }
}

function getFlowToneClass(tone) {
  switch (tone) {
    case 'approved':
      return 'tone-approved';
    case 'rejected':
      return 'tone-rejected';
    case 'disbursed':
      return 'tone-disbursed';
    case 'paid':
      return 'tone-paid';
    case 'active':
      return 'tone-active';
    default:
      return 'tone-pending';
  }
}

function getLoginStatusClass(status) {
  const normalized = String(status || '').toLowerCase();
  if (normalized.includes('done') || normalized.includes('success')) {
    return 'login-status is-success';
  }
  if (normalized.includes('review') || normalized.includes('pending')) {
    return 'login-status is-review';
  }
  return 'login-status is-danger';
}

function formatProductLabel(value) {
  switch (String(value || '').toLowerCase()) {
    case 'business':
      return 'Business Loan';
    case 'home':
      return 'Home Loan';
    case 'vehicle':
      return 'Vehicle Loan';
    case 'personal':
      return 'Personal Loan';
    default:
      return value ? String(value) : 'General';
  }
}

function readStoredLenders(loans = readStoredLoans()) {
  return mergeLendersWithFlow(readCachedLenders(), loans);
}

function Lenders() {
  const navigate = useNavigate();
  const [lenders, setLenders] = useState(() => readStoredLenders());
  const [allLoans, setAllLoans] = useState(() => readStoredLoans());
  const [loadingLenders, setLoadingLenders] = useState(true);
  const [pageError, setPageError] = useState('');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [flowFilter, setFlowFilter] = useState('all');
  const [showAdd, setShowAdd] = useState(false);
  const [newLender, setNewLender] = useState({ name: '', image: '' });
  const [openMenuId, setOpenMenuId] = useState(null);
  const [updateModal, setUpdateModal] = useState(false);
  const [selectedLender, setSelectedLender] = useState(null);
  const [editValues, setEditValues] = useState({ name: '', image: '' });
  const [previewLogins, setPreviewLogins] = useState([]);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewNotice, setPreviewNotice] = useState('');
  const [previewSearch, setPreviewSearch] = useState('');
  const [previewProduct, setPreviewProduct] = useState('all');
  const [previewFlowFilter, setPreviewFlowFilter] = useState('all');

  useEffect(() => {
    let mounted = true;

    const loadLenders = async () => {
      try {
        setLoadingLenders(true);
        setPageError('');
        const nextLoans = readStoredLoans();
        const nextLenders = await syncLendersCache();
        if (mounted) {
          setAllLoans(nextLoans);
          setLenders(mergeLendersWithFlow(nextLenders, nextLoans));
        }
      } catch (error) {
        if (mounted) {
          setAllLoans(readStoredLoans());
          setLenders(readStoredLenders());
          setPageError(error.message || 'Failed to load lenders.');
        }
      } finally {
        if (mounted) {
          setLoadingLenders(false);
        }
      }
    };

    loadLenders();

    const syncData = (event) => {
      const key = event?.detail?.key || event?.key;
      if (!key || key === 'lenders') {
        setLenders(readStoredLenders(allLoans));
      }
      if (!key || key === 'loans') {
        const nextLoans = readStoredLoans();
        setAllLoans(nextLoans);
        setLenders(readStoredLenders(nextLoans));
      }
      if (key === 'lender_logins') {
        setLenders(readStoredLenders(allLoans));
      }
    };

    window.addEventListener('storage', syncData);
    window.addEventListener('focus', syncData);
    window.addEventListener('app:storage-changed', syncData);

    return () => {
      mounted = false;
      window.removeEventListener('storage', syncData);
      window.removeEventListener('focus', syncData);
      window.removeEventListener('app:storage-changed', syncData);
    };
  }, [allLoans]);

  const lenderInsights = useMemo(() => lenders.map((lender) => {
    const insight = buildLenderInsight(lender, allLoans);
    return {
      ...insight,
      displayStatus: insight.status || 'Inactive',
    };
  }), [lenders, allLoans]);

  const flowTotals = useMemo(() => LOAN_STATUS_FLOW.map((status) => ({
    status,
    count: lenderInsights.reduce((sum, lender) => {
      const match = lender.flowBreakdown.find((item) => item.status === status);
      return sum + (match?.count || 0);
    }, 0),
  })), [lenderInsights]);

  const summaryStats = useMemo(() => ({
    totalLenders: lenderInsights.length,
    activeLenders: lenderInsights.filter((item) => item.displayStatus === 'Active').length,
    totalCases: lenderInsights.reduce((sum, item) => sum + item.totalCases, 0),
    totalLogins: lenderInsights.reduce((sum, item) => sum + item.loginsCount, 0),
    disbursedCases: lenderInsights.reduce((sum, item) => sum + item.disbursedCases, 0),
  }), [lenderInsights]);

  const filteredLenders = useMemo(() => lenderInsights.filter((item) => {
    const query = search.trim().toLowerCase();
    const haystack = [
      item.name,
      item.currentFlow,
      item.displayStatus,
      item.lastLoginStatus,
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();
    const matchesSearch = !query || haystack.includes(query);
    const matchesStatus = statusFilter === 'all' || item.displayStatus.toLowerCase() === statusFilter;
    const matchesFlow = flowFilter === 'all' || item.currentFlow === flowFilter;
    return matchesSearch && matchesStatus && matchesFlow;
  }), [flowFilter, lenderInsights, search, statusFilter]);

  const selectedInsight = useMemo(() => {
    if (!selectedLender) {
      return null;
    }

    return buildLenderInsight(
      { ...selectedLender, name: editValues.name || selectedLender.name },
      allLoans
    );
  }, [allLoans, editValues.name, selectedLender]);

  const previewProductOptions = useMemo(() => Array.from(new Set(
    previewLogins.map((item) => item.product || 'general')
  )), [previewLogins]);

  const filteredPreviewLogins = useMemo(() => previewLogins.filter((item) => {
    const query = previewSearch.trim().toLowerCase();
    const haystack = [
      item.leadName,
      item.surrogate,
      item.remarks,
      item.status,
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();
    const matchesSearch = !query || haystack.includes(query);
    const matchesProduct = previewProduct === 'all' || (item.product || 'general') === previewProduct;
    return matchesSearch && matchesProduct;
  }), [previewLogins, previewProduct, previewSearch]);

  const filteredPreviewLoans = useMemo(() => {
    const relatedLoans = selectedInsight?.relatedLoans || [];
    return relatedLoans.filter((loan) => {
      const query = previewSearch.trim().toLowerCase();
      const haystack = [
        loan.customer,
        loan.referenceName,
        loan.type,
        loan.status,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      const matchesSearch = !query || haystack.includes(query);
      const matchesFlow = previewFlowFilter === 'all' || loan.status === previewFlowFilter;
      return matchesSearch && matchesFlow;
    });
  }, [previewFlowFilter, previewSearch, selectedInsight]);

  const openLenderLogins = (lenderId) => {
    navigate(`/lenders/${lenderId}/logins`);
  };

  const toggleMenu = (id) => {
    setOpenMenuId((current) => (current === id ? null : id));
  };

  const closeUpdateModal = () => {
    setUpdateModal(false);
    setSelectedLender(null);
    setPreviewLogins([]);
    setPreviewNotice('');
    setPreviewSearch('');
    setPreviewProduct('all');
    setPreviewFlowFilter('all');
  };

  const openUpdate = async (lender) => {
    setSelectedLender(lender);
    setEditValues({ name: lender.name, image: lender.image || '' });
    setUpdateModal(true);
    setOpenMenuId(null);
    setPreviewLoading(true);
    setPreviewNotice('');
    setPreviewSearch('');
    setPreviewProduct('all');
    setPreviewFlowFilter('all');

    try {
      const { data, warning } = await fetchLenderLogins(lender.id);
      setPreviewLogins(data || []);
      setPreviewNotice(warning || '');
    } catch (error) {
      setPreviewLogins([]);
      setPreviewNotice(error.message || 'Failed to load lender logins.');
    } finally {
      setPreviewLoading(false);
    }
  };

  const saveUpdate = async (e) => {
    e.preventDefault();
    if (!selectedLender) {
      return;
    }

    const previousName = selectedLender.name;
    const nextName = editValues.name.trim() || selectedLender.name;
    const normalizedNextName = normalizeLenderName(nextName);
    const duplicate = lenders.find((item) => item.id !== selectedLender.id && normalizeLenderName(item.name) === normalizedNextName);
    if (duplicate) {
      window.alert(`A lender named ${duplicate.name} already exists in the synchronized flow.`);
      return;
    }

    try {
      setPageError('');
      let nextLoansState = allLoans;

      if (previousName !== nextName) {
        const relatedLoans = allLoans.filter((loan) => normalizeLenderName(loan.lenderName) === normalizeLenderName(previousName));
        const renamedLoans = await Promise.all(
          relatedLoans.map((loan) => updateLoanRecord(loan.id, { lenderName: nextName }))
        );
        const byId = new Map(renamedLoans.map((loan) => [loan.id, loan]));
        nextLoansState = allLoans.map((loan) => byId.get(loan.id) || loan);
        setAllLoans(nextLoansState);
        writeCachedLoans(nextLoansState);
      }

      await updateLenderRecord(selectedLender.id, {
        name: nextName,
        image: editValues.image.trim(),
      });
      const nextLenders = await syncLendersCache();
      setLenders(mergeLendersWithFlow(nextLenders, nextLoansState));
      closeUpdateModal();
    } catch (error) {
      setPageError(error.message || 'Failed to update lender.');
    }
  };

  const addLender = async (e) => {
    e.preventDefault();
    const name = newLender.name.trim();
    if (!name) {
      return;
    }

    const duplicate = lenders.find((item) => normalizeLenderName(item.name) === normalizeLenderName(name));
    try {
      setPageError('');
      if (duplicate) {
        await updateLenderRecord(duplicate.id, {
          name: duplicate.name,
          image: newLender.image.trim() || duplicate.image,
          status: duplicate.status,
        });
      } else {
        await createLenderRecord({
          name: name.toUpperCase(),
          image: newLender.image.trim(),
          status: 'Inactive',
        });
      }

      const nextLenders = await syncLendersCache();
      setLenders(mergeLendersWithFlow(nextLenders, allLoans));
      setShowAdd(false);
      setNewLender({ name: '', image: '' });
    } catch (error) {
      setPageError(error.message || 'Failed to save lender.');
    }
  };

  return (
    <div className="lenders-page">
      <div className="page-header">
        <div>
          <h1>Lenders</h1>
          <p className="lenders-subtitle">Synchronize lender activity, logins, and linked loan stages from the CRM flow.</p>
        </div>
        <button className="btn-primary" onClick={() => setShowAdd(true)}>+ Add Lender</button>
      </div>

      {pageError ? <div className="error-banner">{pageError}</div> : null}

      <div className="lender-stats-grid">
        <div className="lender-stat-card">
          <span className="lender-stat-label">Total Lenders</span>
          <strong className="lender-stat-value">{summaryStats.totalLenders}</strong>
        </div>
        <div className="lender-stat-card">
          <span className="lender-stat-label">Lenders In Flow</span>
          <strong className="lender-stat-value">{summaryStats.activeLenders}</strong>
        </div>
        <div className="lender-stat-card">
          <span className="lender-stat-label">Linked Cases</span>
          <strong className="lender-stat-value">{summaryStats.totalCases}</strong>
        </div>
        <div className="lender-stat-card">
          <span className="lender-stat-label">Disbursed Cases</span>
          <strong className="lender-stat-value">{summaryStats.disbursedCases}</strong>
        </div>
        <div className="lender-stat-card">
          <span className="lender-stat-label">Saved Logins</span>
          <strong className="lender-stat-value">{summaryStats.totalLogins}</strong>
        </div>
      </div>

      <div className="lenders-toolbar">
        <input
          placeholder="Search lenders by name, status, or flow stage"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          <option value="all">All Lender Status</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
        </select>
        <select value={flowFilter} onChange={(e) => setFlowFilter(e.target.value)}>
          <option value="all">All Flow Stages</option>
          {LOAN_STATUS_FLOW.map((status) => (
            <option key={status} value={status}>{status}</option>
          ))}
        </select>
      </div>

      <div className="flow-pill-row">
        {flowTotals.map((item) => (
          <button
            key={item.status}
            type="button"
            className={`flow-pill ${flowFilter === item.status ? 'active' : ''}`}
            onClick={() => setFlowFilter((current) => (current === item.status ? 'all' : item.status))}
          >
            <span>{item.status}</span>
            <strong>{item.count}</strong>
          </button>
        ))}
      </div>

      <div className="lenders-table-wrap">
        <table className="lenders-table">
          <thead>
            <tr>
              <th>ID</th>
              <th>Lender</th>
              <th>Created On</th>
              <th>Status</th>
              <th>Current Flow</th>
              <th>Linked Cases</th>
              <th>In Flow</th>
              <th>Disbursed</th>
              <th>Saved Logins</th>
              <th>Last Login</th>
              <th>Loan Value</th>
              <th>Quick Actions</th>
            </tr>
          </thead>
            <tbody>
            {loadingLenders ? (
              <tr>
                <td colSpan={12} className="empty-table-state">Loading lenders...</td>
              </tr>
            ) : filteredLenders.length === 0 ? (
              <tr>
                <td colSpan={12} className="empty-table-state">No lenders match the selected flow filters.</td>
              </tr>
            ) : (
              filteredLenders.map((lender) => (
                <tr key={lender.id}>
                  <td>{lender.id}</td>
                  <td>
                    <div className="lender-name-cell">
                      {lender.image ? (
                        <img src={lender.image} alt={lender.name} className="lender-logo" />
                      ) : (
                        <div className="placeholder-img">{lender.name.slice(0, 2)}</div>
                      )}
                      <div>
                        <strong>{lender.name}</strong>
                        <div className="lender-meta">
                          {lender.activeFlowCounts.length > 0
                            ? lender.activeFlowCounts.slice(0, 2).map((item) => `${item.status} (${item.count})`).join(' • ')
                            : 'No cases in the synchronized flow yet'}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td>{formatDate(lender.createdAt)}</td>
                  <td><span className={getLenderStatusClass(lender.displayStatus)}>{lender.displayStatus}</span></td>
                  <td>
                    {lender.totalCases > 0 ? (
                      <span className={`flow-badge ${getFlowToneClass(lender.currentFlowTone)}`}>{lender.currentFlow}</span>
                    ) : (
                      <span className="empty-chip">No Cases</span>
                    )}
                  </td>
                  <td>{lender.totalCases}</td>
                  <td>{lender.inFlowCases}</td>
                  <td>{lender.disbursedCases}</td>
                  <td>{lender.loginsCount}</td>
                  <td>{lender.lastLoginDate ? formatDate(lender.lastLoginDate) : '-'}</td>
                  <td>{formatCurrency(lender.totalAmount)}</td>
                  <td className="actions">
                    <button className="icon-btn primary" onClick={() => openLenderLogins(lender.id)}>Logins</button>
                    <div className="menu-wrapper">
                      <button className="icon-btn" onClick={() => toggleMenu(lender.id)}>More</button>
                      {openMenuId === lender.id ? (
                        <div className="menu-dropdown">
                          <button className="menu-item" onClick={() => openUpdate(lender)}>Update</button>
                        </div>
                      ) : null}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {showAdd ? (
        <div className="modal-overlay" onClick={() => setShowAdd(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Add Lender</h3>
              <button className="modal-close" onClick={() => setShowAdd(false)}>x</button>
            </div>
            <form onSubmit={addLender}>
              <div className="form-row">
                <label>Name</label>
                <input
                  required
                  value={newLender.name}
                  onChange={(e) => setNewLender({ ...newLender, name: e.target.value })}
                />
              </div>
              <div className="form-row">
                <label>Image URL</label>
                <input
                  value={newLender.image}
                  onChange={(e) => setNewLender({ ...newLender, image: e.target.value })}
                />
              </div>
              <div className="modal-actions">
                <button type="button" className="btn-secondary" onClick={() => setShowAdd(false)}>Cancel</button>
                <button type="submit" className="btn-primary">Add Lender</button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {updateModal && selectedLender && selectedInsight ? (
        <div className="modal-overlay update-modal" onClick={closeUpdateModal}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="left">
              <div className="modal-header">
                <div>
                  <h3>Update Lender - {selectedLender.name}</h3>
                  <p className="modal-subtitle">Manage lender details while tracking the live case flow on the same screen.</p>
                </div>
                <button className="modal-close" onClick={closeUpdateModal}>x</button>
              </div>
              <form onSubmit={saveUpdate}>
                <div className="form-group">
                  <label>Name</label>
                  <input
                    value={editValues.name}
                    onChange={(e) => setEditValues({ ...editValues, name: e.target.value })}
                    required
                  />
                </div>
                <div className="form-group">
                  <label>Image URL</label>
                  <input
                    value={editValues.image}
                    onChange={(e) => setEditValues({ ...editValues, image: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label>Flow Synchronized Status</label>
                  <div className="sync-status-box">
                    <span className={getLenderStatusClass(selectedInsight.status)}>
                      {selectedInsight.status}
                    </span>
                    <p>Status is auto-updated from linked loan flow and saved lender logins.</p>
                  </div>
                </div>

                <div className="modal-actions">
                  <button type="button" className="btn-secondary" onClick={closeUpdateModal}>Cancel</button>
                  <button type="submit" className="btn-primary">Save Changes</button>
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={() => openLenderLogins(selectedLender.id)}
                  >
                    View Full Logins
                  </button>
                </div>
              </form>
            </div>

            <div className="right">
              <div className="preview-metrics">
                <div className="preview-card">
                  <span>Current Flow</span>
                  <strong>{selectedInsight.currentFlow}</strong>
                </div>
                <div className="preview-card">
                  <span>Linked Cases</span>
                  <strong>{selectedInsight.totalCases}</strong>
                </div>
                <div className="preview-card">
                  <span>Saved Logins</span>
                  <strong>{previewLogins.length}</strong>
                </div>
                <div className="preview-card">
                  <span>Loan Value</span>
                  <strong>{formatCurrency(selectedInsight.totalAmount)}</strong>
                </div>
              </div>

              {previewNotice ? (
                <div className="notice-banner">{previewNotice}</div>
              ) : null}

              <div className="preview-filter-row">
                <input
                  placeholder="Search logins and cases"
                  value={previewSearch}
                  onChange={(e) => setPreviewSearch(e.target.value)}
                />
                <select value={previewProduct} onChange={(e) => setPreviewProduct(e.target.value)}>
                  <option value="all">All Products</option>
                  {previewProductOptions.map((item) => (
                    <option key={item} value={item}>{formatProductLabel(item)}</option>
                  ))}
                </select>
                <select value={previewFlowFilter} onChange={(e) => setPreviewFlowFilter(e.target.value)}>
                  <option value="all">All Flow Stages</option>
                  {LOAN_STATUS_FLOW.map((status) => (
                    <option key={status} value={status}>{status}</option>
                  ))}
                </select>
              </div>

              <div className="preview-panel">
                <div className="panel-header">
                  <h4>Recent Logins</h4>
                  <span>{filteredPreviewLogins.length} items</span>
                </div>
                {previewLoading ? (
                  <div className="empty-state">Loading lender logins...</div>
                ) : filteredPreviewLogins.length === 0 ? (
                  <div className="empty-state">No lender logins match the selected filters.</div>
                ) : (
                  <div className="preview-list">
                    {filteredPreviewLogins.map((item) => (
                      <div key={item._id} className="login-preview-row">
                        <div className="row-top">
                          <div>
                            <strong>{item.leadName || 'Unnamed lead'}</strong>
                            <div className="row-meta">{item.surrogate || 'No surrogate'} • {formatProductLabel(item.product)}</div>
                          </div>
                          <div className="row-actions">
                            <span className={getLoginStatusClass(item.status)}>{item.status || 'Pending'}</span>
                            <span className="row-date">{formatDate(item.loginDate)}</span>
                          </div>
                        </div>
                        <div className="row-meta">{item.remarks || 'No remarks added.'}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="preview-panel">
                <div className="panel-header">
                  <h4>Related Flow Cases</h4>
                  <span>{filteredPreviewLoans.length} items</span>
                </div>
                {filteredPreviewLoans.length === 0 ? (
                  <div className="empty-state">No linked lender cases match the flow filter.</div>
                ) : (
                  <div className="preview-list">
                    {filteredPreviewLoans.map((loan) => {
                      const tone = selectedInsight.flowBreakdown.find((item) => item.status === loan.status)?.tone || selectedInsight.currentFlowTone;
                      return (
                        <div key={loan.id} className="flow-case-row">
                          <div>
                            <strong>{loan.customer || 'Unknown customer'}</strong>
                            <div className="row-meta">{loan.type || 'Loan'} • {formatCurrency(loan.amount)} • {formatDate(loan.date)}</div>
                            <div className="row-meta">{loan.referenceName || 'No reference'}</div>
                          </div>
                          <div className="row-actions">
                            <span className={`flow-badge ${getFlowToneClass(tone)}`}>{loan.status}</span>
                            <button type="button" className="text-link-btn" onClick={() => navigate(`/loans/${loan.id}`)}>
                              Open Loan
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export default Lenders;
