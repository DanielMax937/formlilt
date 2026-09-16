export const DEMOS = [
  {
    slug: 'change-of-address',
    title: 'A fresh start',
    formTitle: 'Change of address',
    publisher: 'IRS · Form 8822',
    category: 'Government',
    description: 'Tell the IRS where to find you.',
    color: 'blue',
  },
  {
    slug: 'insurance-claim',
    title: 'One less thing to claim',
    formTitle: 'CHAMPVA insurance claim',
    publisher: 'Veterans Affairs · 10-7959a',
    category: 'Insurance',
    description: 'Make sense of a medical reimbursement.',
    color: 'green',
  },
  {
    slug: 'medical-release',
    title: 'Ready for the school trip',
    formTitle: 'School medical authorization',
    publisher: 'Dublin City School District',
    category: 'School & health',
    description: 'Get the paperwork out of the way.',
    color: 'purple',
  },
] as const;
export type DemoSlug = (typeof DEMOS)[number]['slug'];
