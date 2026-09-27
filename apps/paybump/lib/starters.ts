import type { BumpMacro } from './types';

export function createStarterMacros(now = Date.now()): BumpMacro[] {
  const mk = (
    partial: Omit<BumpMacro, 'id' | 'createdAt' | 'updatedAt' | 'usageCount'>,
  ): BumpMacro => ({
    ...partial,
    id: crypto.randomUUID(),
    createdAt: now,
    updatedAt: now,
    usageCount: 0,
  });

  return [
    mk({
      title: 'Friendly card update',
      shortcut: ';card',
      niche: 'stripe',
      body: `Hi {{name}},

Your latest payment for {{product}} didn't go through (usually an expired card or bank decline).

You can update billing here in about 30 seconds:
{{billing_portal_url}}

Reply if anything looks wrong — happy to help.

Thanks,
{{your_name}}`,
    }),
    mk({
      title: 'Day-3 reminder',
      shortcut: ';d3',
      niche: 'stripe',
      body: `Hi {{name}} — quick reminder that {{product}} is past due after a failed charge on {{failed_date}}.

Update your card: {{billing_portal_url}}

We'll keep access open a bit longer, then pause on {{pause_date}} to avoid surprise usage.

— {{your_name}}`,
    }),
    mk({
      title: 'Final notice',
      shortcut: ';final',
      niche: 'stripe',
      body: `Hi {{name}},

This is a final notice before we suspend {{product}} for the failed payment of {{amount}}.

Secure update link: {{billing_portal_url}}

If you've already paid, thank you — reply with the receipt and we'll reinstate immediately.

{{your_name}}`,
    }),
    mk({
      title: 'Invoice bump',
      shortcut: ';inv',
      niche: 'invoice',
      body: `Hi {{name}},

Friendly bump on invoice {{invoice_number}} ({{amount}}, due {{due_date}}).

Pay link: {{invoice_url}}

Let me know if you need it resent to AP or split across POs.

Thanks,
{{your_name}}`,
    }),
    mk({
      title: 'ACH / wire instructions',
      shortcut: ';wire',
      niche: 'invoice',
      body: `Happy to take bank transfer for invoice {{invoice_number}}:

Amount: {{amount}}
Reference: {{invoice_number}} / {{company}}

{{bank_details}}

Email the remittance advice to {{ap_email}} so we can reconcile quickly.`,
    }),
  ];
}
