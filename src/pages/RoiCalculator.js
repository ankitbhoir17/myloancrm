import React, { useState } from 'react';
import './RoiCalculator.css';

function formatCurrency(value) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(value || 0);
}

function formatPercent(value) {
  return `${(value || 0).toFixed(2)}%`;
}

function calculateEmi(principal, monthlyRate, months) {
  if (monthlyRate === 0) {
    return principal / months;
  }

  const factor = Math.pow(1 + monthlyRate, months);
  return (principal * monthlyRate * factor) / (factor - 1);
}

function solveMonthlyRate(principal, emi, months) {
  const minimumEmi = principal / months;
  if (emi < minimumEmi) {
    return null;
  }

  if (Math.abs(emi - minimumEmi) < 0.01) {
    return 0;
  }

  let low = 0;
  let high = 1;

  while (calculateEmi(principal, high, months) < emi && high < 100) {
    high *= 2;
  }

  for (let index = 0; index < 80; index += 1) {
    const mid = (low + high) / 2;
    const calculatedEmi = calculateEmi(principal, mid, months);

    if (calculatedEmi > emi) {
      high = mid;
    } else {
      low = mid;
    }
  }

  return (low + high) / 2;
}

function RoiCalculator() {
  const [values, setValues] = useState({
    principal: '1000000',
    emi: '21247',
    tenure: '60',
    tenureUnit: 'months',
  });
  const [result, setResult] = useState(() => {
    const principal = 1000000;
    const emi = 21247;
    const months = 60;
    const monthlyRate = solveMonthlyRate(principal, emi, months);
    const totalRepayment = emi * months;
    const totalInterest = totalRepayment - principal;

    return {
      annualRate: monthlyRate * 12 * 100,
      monthlyRate: monthlyRate * 100,
      effectiveAnnualRate: (Math.pow(1 + monthlyRate, 12) - 1) * 100,
      totalRepayment,
      totalInterest,
      months,
    };
  });
  const [error, setError] = useState('');

  const handleChange = (field, nextValue) => {
    setValues((current) => ({ ...current, [field]: nextValue }));
  };

  const handleCalculate = (e) => {
    e.preventDefault();

    const principal = Number(values.principal);
    const emi = Number(values.emi);
    const rawTenure = Number(values.tenure);
    const months = values.tenureUnit === 'years' ? rawTenure * 12 : rawTenure;

    if (!principal || !emi || !rawTenure || months <= 0) {
      setError('Enter valid loan amount, EMI, and tenure values.');
      setResult(null);
      return;
    }

    const monthlyRate = solveMonthlyRate(principal, emi, months);
    if (monthlyRate === null) {
      setError('EMI is too low for the selected loan amount and tenure.');
      setResult(null);
      return;
    }

    const totalRepayment = emi * months;
    const totalInterest = totalRepayment - principal;

    setError('');
    setResult({
      annualRate: monthlyRate * 12 * 100,
      monthlyRate: monthlyRate * 100,
      effectiveAnnualRate: (Math.pow(1 + monthlyRate, 12) - 1) * 100,
      totalRepayment,
      totalInterest,
      months,
    });
  };

  const handleReset = () => {
    setValues({
      principal: '1000000',
      emi: '21247',
      tenure: '60',
      tenureUnit: 'months',
    });
    setError('');

    const principal = 1000000;
    const emi = 21247;
    const months = 60;
    const monthlyRate = solveMonthlyRate(principal, emi, months);

    setResult({
      annualRate: monthlyRate * 12 * 100,
      monthlyRate: monthlyRate * 100,
      effectiveAnnualRate: (Math.pow(1 + monthlyRate, 12) - 1) * 100,
      totalRepayment: emi * months,
      totalInterest: (emi * months) - principal,
      months,
    });
  };

  return (
    <div className="roi-page">
      <div className="page-header">
        <div>
          <h1>Rate Of Interest Calculator</h1>
          <p className="roi-subtitle">
            Find the annual interest rate from loan amount, EMI, and tenure using the reducing-balance method.
          </p>
        </div>
      </div>

      <div className="roi-layout">
        <section className="section roi-form-card">
          <h2>Calculator Inputs</h2>
          <form onSubmit={handleCalculate} className="roi-form">
            <div className="form-group">
              <label htmlFor="principal">Loan Amount</label>
              <input
                id="principal"
                type="number"
                min="1"
                value={values.principal}
                onChange={(e) => handleChange('principal', e.target.value)}
                placeholder="Enter principal amount"
              />
            </div>

            <div className="form-group">
              <label htmlFor="emi">Monthly EMI</label>
              <input
                id="emi"
                type="number"
                min="1"
                value={values.emi}
                onChange={(e) => handleChange('emi', e.target.value)}
                placeholder="Enter monthly EMI"
              />
            </div>

            <div className="roi-tenure-row">
              <div className="form-group">
                <label htmlFor="tenure">Tenure</label>
                <input
                  id="tenure"
                  type="number"
                  min="1"
                  value={values.tenure}
                  onChange={(e) => handleChange('tenure', e.target.value)}
                  placeholder="Enter tenure"
                />
              </div>

              <div className="form-group">
                <label htmlFor="tenureUnit">Unit</label>
                <select
                  id="tenureUnit"
                  value={values.tenureUnit}
                  onChange={(e) => handleChange('tenureUnit', e.target.value)}
                  className="roi-select"
                >
                  <option value="months">Months</option>
                  <option value="years">Years</option>
                </select>
              </div>
            </div>

            {error ? <div className="error-message">{error}</div> : null}

            <div className="roi-actions">
              <button type="submit" className="btn-primary">Calculate ROI</button>
              <button type="button" className="btn-secondary" onClick={handleReset}>Reset</button>
            </div>
          </form>
        </section>

        <section className="section roi-info-card">
          <h2>How It Works</h2>
          <p className="roi-note">
            This calculator derives the interest rate from the EMI formula used for reducing-balance loans.
          </p>
          <div className="roi-info-grid">
            <div className="roi-info-item">
              <span className="roi-info-label">Best for</span>
              <strong>Home, business, vehicle, and personal loans</strong>
            </div>
            <div className="roi-info-item">
              <span className="roi-info-label">Input needed</span>
              <strong>Principal, EMI, and total tenure</strong>
            </div>
            <div className="roi-info-item">
              <span className="roi-info-label">Method</span>
              <strong>Reducing balance EMI reverse calculation</strong>
            </div>
          </div>
        </section>
      </div>

      {result ? (
        <>
          <div className="roi-results-grid">
            <div className="roi-stat-card primary">
              <span className="roi-stat-label">Annual ROI</span>
              <strong className="roi-stat-value">{formatPercent(result.annualRate)}</strong>
              <span className="roi-stat-caption">Nominal annual interest rate</span>
            </div>
            <div className="roi-stat-card">
              <span className="roi-stat-label">Monthly ROI</span>
              <strong className="roi-stat-value">{formatPercent(result.monthlyRate)}</strong>
              <span className="roi-stat-caption">Monthly reducing rate</span>
            </div>
            <div className="roi-stat-card">
              <span className="roi-stat-label">Effective Annual Rate</span>
              <strong className="roi-stat-value">{formatPercent(result.effectiveAnnualRate)}</strong>
              <span className="roi-stat-caption">Compounded annual view</span>
            </div>
          </div>

          <section className="section roi-breakdown">
            <div className="section-header">
              <h2>Payment Breakdown</h2>
            </div>
            <div className="roi-breakdown-grid">
              <div className="roi-breakdown-item">
                <span>Total Repayment</span>
                <strong>{formatCurrency(result.totalRepayment)}</strong>
              </div>
              <div className="roi-breakdown-item">
                <span>Total Interest</span>
                <strong>{formatCurrency(result.totalInterest)}</strong>
              </div>
              <div className="roi-breakdown-item">
                <span>Total Months</span>
                <strong>{result.months}</strong>
              </div>
            </div>
          </section>
        </>
      ) : null}
    </div>
  );
}

export default RoiCalculator;
