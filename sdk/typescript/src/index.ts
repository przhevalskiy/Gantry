import { HttpClient } from './http';
import { Tasks, Projects } from './resources';

export { GantryApiError } from './http';
export type { Task, Project, TaskStatus, SubmitTaskOptions, WaitOptions, BulkResponse, BulkResult } from './types';

const DEFAULT_BASE_URL = 'https://api.monolift.dev';

export class GantryClient {
  readonly tasks: Tasks;
  readonly projects: Projects;

  constructor(options: { apiKey?: string; baseUrl?: string } = {}) {
    const apiKey =
      options.apiKey ??
      (typeof globalThis !== 'undefined' && 'process' in globalThis
        ? (globalThis as { process?: { env?: Record<string, string> } }).process?.env?.GANTRY_API_KEY
        : undefined);

    if (!apiKey) {
      throw new Error(
        'apiKey is required. Pass it directly or set GANTRY_API_KEY env var.',
      );
    }

    const baseUrl = options.baseUrl ?? DEFAULT_BASE_URL;
    const http = new HttpClient(baseUrl, apiKey);
    this.tasks = new Tasks(http);
    this.projects = new Projects(http);
  }
}
