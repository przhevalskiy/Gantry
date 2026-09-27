import type { FormProfile } from './types';

export function createStarterProfiles(now = Date.now()): FormProfile[] {
  const mk = (
    partial: Omit<FormProfile, 'id' | 'createdAt' | 'updatedAt'>,
  ): FormProfile => ({
    ...partial,
    id: crypto.randomUUID(),
    createdAt: now,
    updatedAt: now,
  });

  return [
    mk({
      name: 'Shipping — HQ',
      niche: 'shipping',
      fields: [
        { key: 'full name / name / ship-to', value: 'Alex Rivera' },
        { key: 'email', value: 'alex@example.com' },
        { key: 'phone / tel', value: '+1 555 010 2299' },
        { key: 'address / address1 / street', value: '120 Market St' },
        { key: 'address2 / apt', value: 'Suite 400' },
        { key: 'city', value: 'San Francisco' },
        { key: 'state / province / region', value: 'CA' },
        { key: 'zip / postal / postcode', value: '94105' },
        { key: 'country', value: 'United States' },
      ],
    }),
    mk({
      name: 'Grant applicant',
      niche: 'grant',
      fields: [
        { key: 'organization / org / applicant', value: 'Northwind Lab' },
        { key: 'ein / tax id', value: '12-3456789' },
        { key: 'pi / investigator / contact name', value: 'Dr. Sam Chen' },
        { key: 'email', value: 'grants@northwindlab.org' },
        { key: 'phone', value: '+1 555 014 8800' },
        { key: 'project title / title', value: 'Community resilience pilot' },
        { key: 'amount / budget / requested', value: '50000' },
      ],
    }),
    mk({
      name: 'Admin / support contact',
      niche: 'admin',
      fields: [
        { key: 'company / business', value: 'Acme Ops LLC' },
        { key: 'name / contact', value: 'Jamie Lee' },
        { key: 'email / work email', value: 'jamie@acmeops.example' },
        { key: 'role / title / job', value: 'Operations Lead' },
        { key: 'website / url', value: 'https://acmeops.example' },
      ],
    }),
  ];
}
