import { SampleQuestion } from '@/shared/types/sampleQuestions';

/** Factory goal starters — generic platform copy (M1). */
export const FACTORY_STARTERS: SampleQuestion[] = [
  {
    main: 'Fix & ship',
    subQuestions: [
      { text: 'Fix accessibility violations in the React app and open a PR' },
      { text: 'Resolve ESLint errors in the frontend and add missing tests' },
      { text: 'Patch a failing CI check and document the fix in the PR' },
    ],
  },
  {
    main: 'Refactor',
    subQuestions: [
      { text: 'Extract shared utilities from duplicated components into a lib folder' },
      { text: 'Split an oversized module into focused files without behavior changes' },
      { text: 'Migrate a package to TypeScript strict mode incrementally' },
    ],
  },
  {
    main: 'Feature slice',
    subQuestions: [
      { text: 'Add an API endpoint with tests and wire it through the SDK' },
      { text: 'Implement a settings page backed by existing /v1 routes' },
      { text: 'Add SSE task events to the web client with typed adapters' },
    ],
  },
  {
    main: 'Docs & hygiene',
    subQuestions: [
      { text: 'Update README and deployment docs to match current architecture' },
      { text: 'Add integration tests for the task submit and SSE contract' },
      { text: 'Clean up dead routes and align env examples with production' },
    ],
  },
];
