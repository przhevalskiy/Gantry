export class GantryApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly body: unknown,
  ) {
    super(`Gantry API error ${status}: ${JSON.stringify(body)}`);
    this.name = 'GantryApiError';
  }
}

export class HttpClient {
  constructor(
    private readonly baseUrl: string,
    private readonly apiKey: string,
  ) {}

  private headers(): Record<string, string> {
    return {
      'Authorization': `Bearer ${this.apiKey}`,
      'Content-Type': 'application/json',
    };
  }

  private url(path: string): string {
    return `${this.baseUrl}${path}`;
  }

  async get<T>(path: string): Promise<T> {
    const res = await fetch(this.url(path), { headers: this.headers() });
    if (!res.ok) throw new GantryApiError(res.status, await res.json().catch(() => null));
    return res.json() as Promise<T>;
  }

  async post<T>(path: string, body?: unknown): Promise<T> {
    const res = await fetch(this.url(path), {
      method: 'POST',
      headers: this.headers(),
      body: JSON.stringify(body ?? {}),
    });
    if (!res.ok) throw new GantryApiError(res.status, await res.json().catch(() => null));
    return res.json() as Promise<T>;
  }

  async patch<T>(path: string, body?: unknown): Promise<T> {
    const res = await fetch(this.url(path), {
      method: 'PATCH',
      headers: this.headers(),
      body: JSON.stringify(body ?? {}),
    });
    if (!res.ok) throw new GantryApiError(res.status, await res.json().catch(() => null));
    return res.json() as Promise<T>;
  }

  async delete(path: string): Promise<void> {
    const res = await fetch(this.url(path), {
      method: 'DELETE',
      headers: this.headers(),
    });
    if (!res.ok) throw new GantryApiError(res.status, await res.json().catch(() => null));
  }

  async *streamSSE(path: string): AsyncGenerator<Record<string, unknown>, void, unknown> {
    const res = await fetch(this.url(path), {
      headers: { ...this.headers(), Accept: 'text/event-stream' },
    });
    if (!res.ok) throw new GantryApiError(res.status, await res.json().catch(() => null));

    const reader = res.body?.getReader();
    if (!reader) throw new Error('No response body');

    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const frames = buffer.split('\n\n');
      buffer = frames.pop() ?? '';

      for (const frame of frames) {
        const line = frame.split('\n').find(l => l.startsWith('data: '));
        if (!line) continue;
        yield JSON.parse(line.slice(6)) as Record<string, unknown>;
      }
    }
  }
}
