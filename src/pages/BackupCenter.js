import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { addActivity } from '../utils/activities';
import { downloadBackupWorkbook, getBackupSnapshot } from '../utils/backupWorkbook';
import './BackupCenter.css';

function BackupCenter() {
  const { user } = useAuth();
  const [snapshot, setSnapshot] = useState(() => getBackupSnapshot());
  const [downloading, setDownloading] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    const sync = () => {
      setSnapshot(getBackupSnapshot());
    };

    window.addEventListener('storage', sync);
    window.addEventListener('focus', sync);
    window.addEventListener('app:storage-changed', sync);
    window.addEventListener('activities:changed', sync);
    window.addEventListener('recyclebin:changed', sync);
    window.addEventListener('auth:changed', sync);

    return () => {
      window.removeEventListener('storage', sync);
      window.removeEventListener('focus', sync);
      window.removeEventListener('app:storage-changed', sync);
      window.removeEventListener('activities:changed', sync);
      window.removeEventListener('recyclebin:changed', sync);
      window.removeEventListener('auth:changed', sync);
    };
  }, []);

  if (!user || user.role !== 'superuser') {
    return (
      <div className="backup-page">
        <div className="backup-hero">
          <div>
            <h1>Backup Center</h1>
            <p>Access denied. Superuser only.</p>
          </div>
        </div>
      </div>
    );
  }

  const handleDownload = () => {
    setDownloading(true);
    try {
      const { fileName, snapshot: nextSnapshot } = downloadBackupWorkbook();
      setSnapshot(nextSnapshot);
      setMessage(`Backup downloaded as ${fileName}`);
      try {
        addActivity({
          type: 'backup_downloaded',
          actor: user?.username || 'system',
          message: `${fileName} downloaded from Backup Center`,
          meta: { fileName, generatedAt: nextSnapshot.generatedAt },
        });
      } catch (error) {
        // Ignore activity failures and keep backup download successful.
      }
    } catch (error) {
      setMessage(error?.message || 'Failed to generate the Excel backup.');
    } finally {
      setDownloading(false);
    }
  };

  const handleRefresh = () => {
    setSnapshot(getBackupSnapshot());
    setMessage('Backup snapshot refreshed from current CRM data.');
  };

  return (
    <div className="backup-page">
      <div className="backup-hero">
        <div>
          <h1>Backup Center</h1>
          <p>
            Download the CRM data as a real Excel workbook with separate sheets for loan flow,
            customers, lenders, logins, leads, enquiries, users, activities, and recycle bin records.
          </p>
        </div>
        <div className="backup-actions">
          <button type="button" className="backup-secondary-btn" onClick={handleRefresh}>
            Refresh Snapshot
          </button>
          <button type="button" className="backup-primary-btn" onClick={handleDownload} disabled={downloading}>
            {downloading ? 'Preparing Excel Backup...' : 'Download Excel Backup'}
          </button>
        </div>
      </div>

      {message ? <div className="backup-banner">{message}</div> : null}

      <div className="backup-stats-grid">
        <div className="backup-stat-card">
          <span className="backup-stat-label">Loans In Backup</span>
          <strong className="backup-stat-value">{snapshot.counts.loans}</strong>
        </div>
        <div className="backup-stat-card">
          <span className="backup-stat-label">Customers</span>
          <strong className="backup-stat-value">{snapshot.counts.customers}</strong>
        </div>
        <div className="backup-stat-card">
          <span className="backup-stat-label">Lenders Synced</span>
          <strong className="backup-stat-value">{snapshot.counts.lenders}</strong>
        </div>
        <div className="backup-stat-card">
          <span className="backup-stat-label">Lender Logins</span>
          <strong className="backup-stat-value">{snapshot.counts.lenderLogins}</strong>
        </div>
        <div className="backup-stat-card">
          <span className="backup-stat-label">Activities</span>
          <strong className="backup-stat-value">{snapshot.counts.activities}</strong>
        </div>
        <div className="backup-stat-card">
          <span className="backup-stat-label">Recycle Bin Items</span>
          <strong className="backup-stat-value">{snapshot.counts.recycleBin}</strong>
        </div>
      </div>

      <div className="backup-content-grid">
        <section className="backup-panel">
          <div className="backup-panel-header">
            <h2>Workbook Sheets</h2>
            <span>{snapshot.sheets.length} sheets</span>
          </div>
          <div className="backup-sheet-list">
            {snapshot.sheets.map((sheet) => (
              <div key={sheet.name} className="backup-sheet-row">
                <div>
                  <strong>{sheet.label}</strong>
                  <p>{sheet.name}</p>
                </div>
                <span>{sheet.rowCount} rows</span>
              </div>
            ))}
          </div>
        </section>

        <section className="backup-panel emphasis">
          <div className="backup-panel-header">
            <h2>Flow Coverage</h2>
            <span>{snapshot.counts.flowStages} stages</span>
          </div>
          <ul className="backup-notes">
            <li>The Excel file includes a dedicated loans sheet with stage, slug, tone, sanction, disbursal, and in-flow flags.</li>
            <li>A separate flow summary sheet groups counts and total amounts by each CRM loan stage.</li>
            <li>Lender sheets are generated from synchronized flow-linked lenders and saved lender logins.</li>
            <li>The workbook is generated from current browser data, so the export matches what is presently stored in the CRM.</li>
          </ul>
          <div className="backup-meta">
            Last snapshot prepared: <strong>{new Date(snapshot.generatedAt).toLocaleString()}</strong>
          </div>
        </section>
      </div>
    </div>
  );
}

export default BackupCenter;
