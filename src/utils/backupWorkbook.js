import * as XLSX from 'xlsx';
import { getActivities } from './activities';
import { getAllStoredLenderLogins } from './lenderLogins';
import { buildLenderInsight, mergeLendersWithFlow, readStoredLoans } from './lenderFlow';
import { getLoanStatusSlug, getLoanStatusTone, LOAN_STATUS_FLOW } from './loanWorkflow';
import { getRecycleBinItems } from './recycleBin';

const IN_FLOW_EXCLUDED = new Set(['Disbursed', 'Payout Paid', 'Rejected']);
const SANCTIONED_STATUSES = new Set([
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
const DISBURSED_STATUSES = new Set([
  'Disbursed',
  'Payout Pending',
  'Payout Received',
  'Payout Paid',
]);

function readJson(key, fallback = []) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch (error) {
    return fallback;
  }
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function toYesNo(value) {
  return value ? 'Yes' : 'No';
}

function stringifyValue(value) {
  if (value == null) {
    return '';
  }
  if (typeof value === 'object') {
    try {
      return JSON.stringify(value);
    } catch (error) {
      return String(value);
    }
  }
  return String(value);
}

function formatLocalDateTime(value) {
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? '-' : parsed.toLocaleString();
}

function formatFileStamp(date = new Date()) {
  const parts = [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0'),
    String(date.getHours()).padStart(2, '0'),
    String(date.getMinutes()).padStart(2, '0'),
    String(date.getSeconds()).padStart(2, '0'),
  ];

  return `${parts[0]}-${parts[1]}-${parts[2]}-${parts[3]}${parts[4]}${parts[5]}`;
}

function createSheet(rows, headers) {
  const safeRows = asArray(rows);
  if (safeRows.length > 0) {
    const sheet = XLSX.utils.json_to_sheet(safeRows);
    sheet['!cols'] = headers.map((header) => ({
      wch: Math.min(
        40,
        Math.max(
          header.length + 2,
          ...safeRows.map((row) => stringifyValue(row[header]).length + 2)
        )
      ),
    }));
    return sheet;
  }

  return XLSX.utils.aoa_to_sheet([headers]);
}

function readStoredLendersSnapshot(loans) {
  const saved = asArray(readJson('lenders', []));
  return mergeLendersWithFlow(saved, loans);
}

function buildLoanRows(loans, customerLookup) {
  return loans.map((loan) => {
    const flowIndex = LOAN_STATUS_FLOW.indexOf(loan.status);
    return {
      'Loan ID': loan.id,
      Customer: loan.customer || '',
      'Customer ID': loan.customerId || '',
      'Customer Status': customerLookup.get(String(loan.customerId))?.status || '',
      Lender: loan.lenderName || '',
      Reference: loan.referenceName || '',
      'Loan Type': loan.type || '',
      Amount: Number(loan.amount || 0),
      'Interest %': Number(loan.interest || 0),
      'Tenure (Years)': Number(loan.tenure || 0),
      'Flow Stage': loan.status || '',
      'Flow Order': flowIndex === -1 ? '' : flowIndex + 1,
      'Flow Slug': getLoanStatusSlug(loan.status),
      'Flow Tone': getLoanStatusTone(loan.status),
      'In Flow': toYesNo(!IN_FLOW_EXCLUDED.has(loan.status)),
      Sanctioned: toYesNo(SANCTIONED_STATUSES.has(loan.status)),
      Disbursed: toYesNo(DISBURSED_STATUSES.has(loan.status)),
      'Created Date': loan.date || '',
      'Applied Date': loan.appliedDate || '',
      'Approved Date': loan.approvedDate || '',
      'Disbursed Date': loan.disbursedDate || '',
      EMI: Number(loan.emi || 0),
      'Disbursed Amount': Number(loan.disbursedAmount || 0),
      'Outstanding Amount': Number(loan.outstandingAmount || 0),
      'Next EMI Date': loan.nextEmiDate || '',
    };
  });
}

function buildFlowSummaryRows(loans) {
  return LOAN_STATUS_FLOW.map((status, index) => {
    const matching = loans.filter((loan) => loan.status === status);
    const lenders = new Set(matching.map((loan) => loan.lenderName).filter(Boolean));
    return {
      'Flow Order': index + 1,
      'Flow Stage': status,
      'Flow Slug': getLoanStatusSlug(status),
      'Flow Tone': getLoanStatusTone(status),
      'Loan Count': matching.length,
      'Total Amount': matching.reduce((sum, loan) => sum + Number(loan.amount || 0), 0),
      'Unique Lenders': lenders.size,
      'Still In Flow': toYesNo(!IN_FLOW_EXCLUDED.has(status)),
    };
  });
}

function buildCustomerRows(customers) {
  return customers.map((customer) => ({
    'Customer ID': customer.id,
    Name: customer.name || '',
    Email: customer.email || '',
    Phone: customer.phone || '',
    Address: customer.address || '',
    Status: customer.status || '',
    Loans: Number(customer.loans || 0),
    'Total Amount': Number(customer.totalAmount || 0),
    'Join Date': customer.joinDate || '',
  }));
}

function buildLenderRows(lenderInsights) {
  return lenderInsights.map((lender) => ({
    'Lender ID': lender.id,
    Lender: lender.name || '',
    Status: lender.status || '',
    'Current Flow': lender.currentFlow || '',
    'Current Flow Tone': lender.currentFlowTone || '',
    'Linked Cases': Number(lender.totalCases || 0),
    'In Flow Cases': Number(lender.inFlowCases || 0),
    'Disbursed Cases': Number(lender.disbursedCases || 0),
    'Saved Logins': Number(lender.loginsCount || 0),
    'Last Login Date': lender.lastLoginDate || '',
    'Last Login Status': lender.lastLoginStatus || '',
    'Loan Value': Number(lender.totalAmount || 0),
    'Created On': lender.createdAt || '',
  }));
}

function buildLenderLoginRows(logins, lenderLookup) {
  return logins.map((login) => ({
    'Login ID': login._id || '',
    'Lender ID': login.lenderId || '',
    Lender: lenderLookup.get(String(login.lenderId))?.name || '',
    Lead: login.leadName || '',
    Surrogate: login.surrogate || '',
    Product: login.product || '',
    Status: login.status || '',
    Remarks: login.remarks || '',
    'Login Date': login.loginDate || '',
  }));
}

function buildEnquiryRows(enquiries) {
  return enquiries.map((enquiry) => ({
    'Enquiry ID': enquiry.id,
    'Customer ID': enquiry.customerId || '',
    Customer: enquiry.customerName || '',
    Email: enquiry.email || '',
    Phone: enquiry.phone || '',
    Status: enquiry.status || '',
    Date: enquiry.date || '',
    Message: enquiry.message || '',
  }));
}

function buildLeadRows(leads) {
  return leads.map((lead) => ({
    'Lead ID': lead.id,
    'Business Name': lead.businessName || '',
    'Business Entity': lead.businessEntity || '',
    'Contact Person': lead.contactPerson || '',
    Phone: lead.primaryPhone || lead.phone || '',
    City: lead.city || '',
    'Sourced By': lead.sourcedBy || '',
    'Loan Type': lead.loanType || '',
    Status: lead.status || '',
    'Created Date': lead.createdDate || '',
  }));
}

function buildUserRows(users) {
  return users.map((user) => ({
    'User ID': user.id,
    Username: user.username || '',
    Name: user.name || '',
    Role: user.role || '',
    Email: user.email || '',
    'Password Set': toYesNo(Boolean(user.passwordSet ?? user.password)),
  }));
}

function buildActivityRows(activities) {
  return activities.map((activity) => ({
    'Activity ID': activity.id,
    Type: activity.type || '',
    Actor: activity.actor || '',
    Message: activity.message || '',
    Read: toYesNo(activity.read),
    Date: activity.date || '',
    Meta: stringifyValue(activity.meta),
  }));
}

function buildRecycleBinRows(entries) {
  return entries.map((entry) => ({
    'Entry ID': entry.entryId,
    Section: entry.section || '',
    'Entity Type': entry.entityType || '',
    Title: entry.title || '',
    Subtitle: entry.subtitle || '',
    'Record ID': entry.recordId || '',
    'Deleted At': entry.deletedAt || '',
    'Storage Key': entry.storageKey || '',
    Snapshot: stringifyValue(entry.item),
  }));
}

function buildSummaryRows(snapshot) {
  return [
    { Metric: 'Generated At', Value: formatLocalDateTime(snapshot.generatedAt) },
    { Metric: 'Loans', Value: snapshot.counts.loans },
    { Metric: 'Customers', Value: snapshot.counts.customers },
    { Metric: 'Lenders In Backup', Value: snapshot.counts.lenders },
    { Metric: 'Lender Logins', Value: snapshot.counts.lenderLogins },
    { Metric: 'Enquiries', Value: snapshot.counts.enquiries },
    { Metric: 'Leads', Value: snapshot.counts.leads },
    { Metric: 'Users', Value: snapshot.counts.users },
    { Metric: 'Activities', Value: snapshot.counts.activities },
    { Metric: 'Recycle Bin Items', Value: snapshot.counts.recycleBin },
    { Metric: 'Flow Stages Included', Value: snapshot.counts.flowStages },
  ];
}

export function getBackupSnapshot() {
  const generatedAt = new Date().toISOString();
  const loans = readStoredLoans();
  const customers = asArray(readJson('customers', []));
  const enquiries = asArray(readJson('enquiries', []));
  const leads = asArray(readJson('leads', []));
  const users = asArray(readJson('app_users', []));
  const activities = getActivities();
  const recycleBinEntries = getRecycleBinItems();
  const lenders = readStoredLendersSnapshot(loans);
  const lenderInsights = lenders.map((lender) => buildLenderInsight(lender, loans));
  const lenderLogins = getAllStoredLenderLogins();

  const customerLookup = new Map(customers.map((customer) => [String(customer.id), customer]));
  const lenderLookup = new Map(lenders.map((lender) => [String(lender.id), lender]));

  const sheets = [
    {
      name: 'Summary',
      label: 'Backup Summary',
      rows: [],
      headers: ['Metric', 'Value'],
    },
    {
      name: 'Loans Flow',
      label: 'Loans With Flow Attributes',
      rows: buildLoanRows(loans, customerLookup),
      headers: [
        'Loan ID',
        'Customer',
        'Customer ID',
        'Customer Status',
        'Lender',
        'Reference',
        'Loan Type',
        'Amount',
        'Interest %',
        'Tenure (Years)',
        'Flow Stage',
        'Flow Order',
        'Flow Slug',
        'Flow Tone',
        'In Flow',
        'Sanctioned',
        'Disbursed',
        'Created Date',
        'Applied Date',
        'Approved Date',
        'Disbursed Date',
        'EMI',
        'Disbursed Amount',
        'Outstanding Amount',
        'Next EMI Date',
      ],
    },
    {
      name: 'Flow Summary',
      label: 'Loan Stage Summary',
      rows: buildFlowSummaryRows(loans),
      headers: ['Flow Order', 'Flow Stage', 'Flow Slug', 'Flow Tone', 'Loan Count', 'Total Amount', 'Unique Lenders', 'Still In Flow'],
    },
    {
      name: 'Customers',
      label: 'Customers',
      rows: buildCustomerRows(customers),
      headers: ['Customer ID', 'Name', 'Email', 'Phone', 'Address', 'Status', 'Loans', 'Total Amount', 'Join Date'],
    },
    {
      name: 'Lenders',
      label: 'Lenders',
      rows: buildLenderRows(lenderInsights),
      headers: ['Lender ID', 'Lender', 'Status', 'Current Flow', 'Current Flow Tone', 'Linked Cases', 'In Flow Cases', 'Disbursed Cases', 'Saved Logins', 'Last Login Date', 'Last Login Status', 'Loan Value', 'Created On'],
    },
    {
      name: 'Lender Logins',
      label: 'Lender Logins',
      rows: buildLenderLoginRows(lenderLogins, lenderLookup),
      headers: ['Login ID', 'Lender ID', 'Lender', 'Lead', 'Surrogate', 'Product', 'Status', 'Remarks', 'Login Date'],
    },
    {
      name: 'Enquiries',
      label: 'Enquiries',
      rows: buildEnquiryRows(enquiries),
      headers: ['Enquiry ID', 'Customer ID', 'Customer', 'Email', 'Phone', 'Status', 'Date', 'Message'],
    },
    {
      name: 'Leads',
      label: 'Leads',
      rows: buildLeadRows(leads),
      headers: ['Lead ID', 'Business Name', 'Business Entity', 'Contact Person', 'Phone', 'City', 'Sourced By', 'Loan Type', 'Status', 'Created Date'],
    },
    {
      name: 'Users',
      label: 'Users',
      rows: buildUserRows(users),
      headers: ['User ID', 'Username', 'Name', 'Role', 'Email', 'Password Set'],
    },
    {
      name: 'Activities',
      label: 'Activities',
      rows: buildActivityRows(activities),
      headers: ['Activity ID', 'Type', 'Actor', 'Message', 'Read', 'Date', 'Meta'],
    },
    {
      name: 'Recycle Bin',
      label: 'Recycle Bin',
      rows: buildRecycleBinRows(recycleBinEntries),
      headers: ['Entry ID', 'Section', 'Entity Type', 'Title', 'Subtitle', 'Record ID', 'Deleted At', 'Storage Key', 'Snapshot'],
    },
  ];

  const snapshot = {
    generatedAt,
    counts: {
      loans: loans.length,
      customers: customers.length,
      lenders: lenderInsights.length,
      lenderLogins: lenderLogins.length,
      enquiries: enquiries.length,
      leads: leads.length,
      users: users.length,
      activities: activities.length,
      recycleBin: recycleBinEntries.length,
      flowStages: LOAN_STATUS_FLOW.length,
    },
    sheets: sheets.map((sheet) => ({
      ...sheet,
      rowCount: sheet.rows.length,
    })),
  };

  snapshot.sheets[0] = {
    ...snapshot.sheets[0],
    rows: buildSummaryRows(snapshot),
    rowCount: 11,
  };

  return snapshot;
}

export function downloadBackupWorkbook() {
  const snapshot = getBackupSnapshot();
  const workbook = XLSX.utils.book_new();

  snapshot.sheets.forEach((sheet) => {
    const worksheet = createSheet(sheet.rows, sheet.headers);
    XLSX.utils.book_append_sheet(workbook, worksheet, sheet.name);
  });

  const fileName = `myloancrm-backup-${formatFileStamp(new Date(snapshot.generatedAt))}.xlsx`;
  XLSX.writeFile(workbook, fileName);

  return { fileName, snapshot };
}
