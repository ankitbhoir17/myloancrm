import React, { useEffect, useState } from 'react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
} from 'recharts';
import { LOAN_STATUS_FLOW, normalizeLoanRecord } from '../utils/loanWorkflow';
import { readCachedLoans, syncLoansCache } from '../utils/crmData';
import './Dashboard.css';

const sanctionedStatuses = new Set([
  'Sanctioned',
  'Property Doccs Pending',
  'Legal & Tech Innitiated',
  'Legal Tech Done',
  'Docket Pending',
  'Disbursement In Process',
  'Disbursed',
  'Payout Pending',
  'Payout Received',
  'Payout Paid',
]);

const disbursedStatuses = new Set([
  'Disbursed',
  'Payout Pending',
  'Payout Received',
  'Payout Paid',
]);

function readLoans() {
  return readCachedLoans().map(normalizeLoanRecord);
}

function Dashboard() {
  const [allLoans, setAllLoans] = useState(() => readLoans());

  useEffect(() => {
    let isMounted = true;

    const syncLoans = (event) => {
      const key = event?.detail?.key || event?.key;
      if (!key || key === 'loans') {
        setAllLoans(readLoans());
      }
    };

    const ensureLoans = async () => {
      if (readCachedLoans().length > 0) {
        return;
      }

      try {
        await syncLoansCache();
        if (isMounted) {
          setAllLoans(readLoans());
        }
      } catch (error) {
        // Keep the dashboard usable with the cached or seed data.
      }
    };

    ensureLoans();

    window.addEventListener('storage', syncLoans);
    window.addEventListener('focus', syncLoans);
    window.addEventListener('app:storage-changed', syncLoans);

    return () => {
      isMounted = false;
      window.removeEventListener('storage', syncLoans);
      window.removeEventListener('focus', syncLoans);
      window.removeEventListener('app:storage-changed', syncLoans);
    };
  }, []);

  const totalCustomers = new Set(allLoans.map((loan) => loan.customer).filter(Boolean)).size;
  const stats = [
    { id: 1, title: 'Total Loans', value: String(allLoans.length), icon: '₹', color: '#1a73e8' },
    { id: 2, title: 'Loans In Flow', value: String(allLoans.filter((loan) => loan.status !== 'Disbursed' && loan.status !== 'Payout Paid' && loan.status !== 'Rejected').length), icon: '⇄', color: '#34a853' },
    { id: 3, title: 'Sanctioned Cases', value: String(allLoans.filter((loan) => sanctionedStatuses.has(loan.status)).length), icon: '✔', color: '#f59e0b' },
    { id: 4, title: 'Total Customers', value: String(totalCustomers), icon: '◉', color: '#ef4444' },
  ];

  const monthlyData = (() => {
    const months = [];
    const now = new Date();

    for (let index = 5; index >= 0; index -= 1) {
      const date = new Date(now.getFullYear(), now.getMonth() - index, 1);
      const label = `${date.toLocaleString('default', { month: 'short' })} ${date.getFullYear()}`;
      months.push({ key: `${date.getFullYear()}-${date.getMonth() + 1}`, label, sanctioned: 0, disbursed: 0 });
    }

    const byKey = Object.fromEntries(months.map((item) => [item.key, item]));
    allLoans.forEach((loan) => {
      try {
        const date = new Date(loan.date);
        const key = `${date.getFullYear()}-${date.getMonth() + 1}`;
        if (!byKey[key]) {
          return;
        }

        if (sanctionedStatuses.has(loan.status)) {
          byKey[key].sanctioned += Number(loan.amount || 0);
        }

        if (disbursedStatuses.has(loan.status)) {
          byKey[key].disbursed += Number(loan.amount || 0);
        }
      } catch (error) {
        // Ignore invalid dates.
      }
    });

    return Object.values(byKey).map((item) => ({
      label: item.label,
      sanctioned: Math.round(item.sanctioned / 1000),
      disbursed: Math.round(item.disbursed / 1000),
    }));
  })();

  const flowMetricsData = LOAN_STATUS_FLOW.map((status) => ({
    name: status,
    value: allLoans.filter((loan) => loan.status === status).length,
  }));

  const recentLoans = allLoans
    .slice()
    .sort((a, b) => new Date(b.date) - new Date(a.date))
    .slice(0, 5);

  return (
    <div className="dashboard">
      <div className="stats-grid">
        {stats.map((stat) => (
          <div key={stat.id} className="stat-card" style={{ borderTopColor: stat.color }}>
            <div className="stat-icon" style={{ backgroundColor: stat.color }}>
              {stat.icon}
            </div>
            <div className="stat-info">
              <h3 className="stat-value">{stat.value}</h3>
              <p className="stat-title">{stat.title}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="dashboard-sections">
        <div className="section">
          <div className="section-header">
            <h2>Loan Flow Metrics</h2>
          </div>
          <div style={{ height: 260 }}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={flowMetricsData} margin={{ top: 10, right: 20, left: 0, bottom: 40 }}>
                <defs>
                  <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#8884d8" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#8884d8" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="name" angle={-25} textAnchor="end" interval={0} height={80} />
                <YAxis allowDecimals={false} />
                <CartesianGrid strokeDasharray="3 3" />
                <Tooltip />
                <Area type="monotone" dataKey="value" stroke="#8884d8" fillOpacity={1} fill="url(#colorValue)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="section quick-actions">
          <h2>Monthly Sanctions And Disbursals</h2>
          <div style={{ height: 260 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={monthlyData} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="label" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="sanctioned" fill="#8884d8" name="Sanctioned (k)" />
                <Bar dataKey="disbursed" fill="#82ca9d" name="Disbursed (k)" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="section">
        <div className="section-header">
          <h2>Recent Loans</h2>
        </div>
        <div className="table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>Customer</th>
                <th>Lender Name</th>
                <th>Refference Name</th>
                <th>Amount</th>
                <th>Status</th>
                <th>Date</th>
              </tr>
            </thead>
            <tbody>
              {recentLoans.map((loan) => (
                <tr key={loan.id}>
                  <td>{loan.customer}</td>
                  <td>{loan.lenderName || '-'}</td>
                  <td>{loan.referenceName || '-'}</td>
                  <td>Rs. {Number(loan.amount || 0).toLocaleString()}</td>
                  <td>{loan.status}</td>
                  <td>{loan.date}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export default Dashboard;
