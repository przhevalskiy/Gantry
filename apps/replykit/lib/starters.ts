import type { Snippet } from './types';

/** Starter pack — Upwork / freelance proposal macros */
export function createStarterSnippets(now = Date.now()): Snippet[] {
  const base = (partial: Omit<Snippet, 'id' | 'createdAt' | 'updatedAt' | 'usageCount'>): Snippet => ({
    ...partial,
    id: crypto.randomUUID(),
    createdAt: now,
    updatedAt: now,
    usageCount: 0,
  });

  return [
    base({
      title: 'Cold intro',
      shortcut: ';intro',
      niche: 'upwork',
      tags: ['proposal', 'opener'],
      body: `Hi {{client_name}},

I read your brief carefully — especially the part about {{pain_point}}. I've shipped similar work for {{similar_client}}, and I can start this week.

Happy to share a short plan and timeline if useful.

Best,
{{your_name}}`,
    }),
    base({
      title: 'Relevant experience',
      shortcut: ';exp',
      niche: 'upwork',
      tags: ['proposal'],
      body: `Recent relevant work:
• {{project_1}} — {{result_1}}
• {{project_2}} — {{result_2}}
• {{project_3}} — {{result_3}}

I can mirror that approach for your project with clear milestones and weekly updates.`,
    }),
    base({
      title: 'Scoped offer',
      shortcut: ';scope',
      niche: 'upwork',
      tags: ['proposal', 'pricing'],
      body: `Suggested scope for a clean first pass:
1. Discovery call + written plan ({{hours_1}}h)
2. Implementation of {{deliverable}} ({{hours_2}}h)
3. Review round + handoff docs ({{hours_3}}h)

Fixed price for this package: {{price}}
Turnaround: {{days}} business days after kickoff.`,
    }),
    base({
      title: 'Follow-up bump',
      shortcut: ';bump',
      niche: 'upwork',
      tags: ['follow-up'],
      body: `Hi {{client_name}} — quick follow-up on my proposal for {{project_title}}.

Still happy to help if the role is open. I can adjust scope or timing if your priorities shifted.

Thanks,
{{your_name}}`,
    }),
    base({
      title: 'Availability reply',
      shortcut: ';avail',
      niche: 'email',
      tags: ['scheduling'],
      body: `Thanks for reaching out. I'm available {{day_window}} and can jump on a {{duration}}-minute call.

Share a couple of times that work, or grab a slot here: {{calendar_link}}`,
    }),
    base({
      title: 'Support acknowledgment',
      shortcut: ';ack',
      niche: 'support',
      tags: ['support'],
      body: `Thanks for the details — I've got this.

I'm looking into {{issue}} now and will update you within {{sla}} with either a fix or a clear next step.`,
    }),
  ];
}
