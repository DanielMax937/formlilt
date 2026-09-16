export const sample = {
  title: 'Registration',
  language: 'en',
  source: 'pdf',
  precision: 'exact',
  pages: [{ index: 0, widthPt: 612, heightPt: 792, kind: 'text' }],
  sections: [{ id: 'personal', title: 'Personal', fieldIds: ['name'] }],
  fields: [
    {
      id: 'name',
      label: 'Full name',
      section: 'personal',
      type: 'text',
      required: true,
      anchor: { page: 0, labelText: 'Full name', placement: 'below' },
    },
  ],
  estimatedMinutes: 1,
};
