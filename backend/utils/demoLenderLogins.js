const demoLogins = [
  {
    _id: 'demo-1',
    lenderId: 1,
    leadName: 'Acme Enterprises',
    surrogate: 'Ramesh',
    loginDate: new Date('2026-02-10'),
    status: 'Done',
    remarks: 'Successful',
    product: 'business',
  },
  {
    _id: 'demo-2',
    lenderId: 1,
    leadName: 'Bright Solutions',
    surrogate: 'Suresh',
    loginDate: new Date('2026-02-09'),
    status: 'Done',
    remarks: 'Successful',
    product: 'business',
  },
  {
    _id: 'demo-3',
    lenderId: 1,
    leadName: 'Comfy Retail',
    surrogate: 'Anita',
    loginDate: new Date('2026-02-08'),
    status: 'Failed',
    remarks: 'Invalid docs',
    product: 'home',
  },
  {
    _id: 'demo-4',
    lenderId: 2,
    leadName: 'Metro Trading Co.',
    surrogate: 'Pooja',
    loginDate: new Date('2026-02-11'),
    status: 'Done',
    remarks: 'Income proof verified',
    product: 'business',
  },
  {
    _id: 'demo-5',
    lenderId: 2,
    leadName: 'Sunrise Developers',
    surrogate: 'Kiran',
    loginDate: new Date('2026-02-07'),
    status: 'Pending',
    remarks: 'Waiting for bank statement',
    product: 'home',
  },
];

function getDemoLoginsByLender(lenderId) {
  return demoLogins.filter((item) => String(item.lenderId) === String(lenderId));
}

module.exports = {
  getDemoLoginsByLender,
};
