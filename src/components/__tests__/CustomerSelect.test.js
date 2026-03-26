import React from 'react';
import '@testing-library/jest-dom';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import CustomerSelect from '../CustomerSelect';

describe('CustomerSelect', () => {
  beforeEach(() => {
    // seed localStorage customers
    const customers = [
      { id: 1, name: 'Alice Cooper', email: 'alice@example.com', phone: '111' },
      { id: 2, name: 'Bob Marley', email: 'bob@example.com', phone: '222' },
      { id: 3, name: 'Alice Smith', email: 'asmith@example.com', phone: '333' }
    ];
    localStorage.setItem('customers', JSON.stringify(customers));
  });

  afterEach(() => {
    localStorage.removeItem('customers');
  });

  test('shows suggestions and returns id/name on selection', async () => {
    const handleChange = jest.fn();
    render(<CustomerSelect mode="input" onChange={handleChange} placeholder="Search" />);

    const input = screen.getByPlaceholderText('Search');
    // type 'Alice' to match two entries
    fireEvent.change(input, { target: { value: 'Alice' } });

    // suggestions should appear
    await waitFor(() => {
      expect(screen.getByText('Alice Cooper')).toBeInTheDocument();
      expect(screen.getByText('Alice Smith')).toBeInTheDocument();
    });

    // click the first suggestion
    const first = screen.getByText('Alice Cooper');
    fireEvent.mouseDown(first);

    // onChange should be called with matching id and name
    expect(handleChange).toHaveBeenCalled();
    const lastCall = handleChange.mock.calls[handleChange.mock.calls.length - 1][0];
    expect(lastCall.customerId).toBe('1');
    expect(lastCall.customerName).toBe('Alice Cooper');
  });
});
