import { NextRequest, NextResponse } from 'next/server';

const GITHUB_TOKEN = process.env.GITHUB_TOKEN ?? '';

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const owner = searchParams.get('owner');
  const repo = searchParams.get('repo');
  const branch = searchParams.get('branch');

  if (!owner || !repo || !branch) {
    return NextResponse.json({ error: 'owner, repo, branch required' }, { status: 400 });
  }

  const res = await fetch(
    `https://api.github.com/repos/${owner}/${repo}/git/trees/${branch}?recursive=1`,
    {
      headers: {
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
        ...(GITHUB_TOKEN ? { Authorization: `Bearer ${GITHUB_TOKEN}` } : {}),
      },
      next: { revalidate: 60 },
    },
  );

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    return NextResponse.json(
      { error: (body as { message?: string }).message ?? `GitHub error ${res.status}` },
      { status: res.status },
    );
  }

  const data = await res.json() as { tree?: { type: string; path: string }[] };
  const files = (data.tree ?? [])
    .filter(item => item.type === 'blob')
    .map(item => item.path);

  return NextResponse.json({ files });
}
