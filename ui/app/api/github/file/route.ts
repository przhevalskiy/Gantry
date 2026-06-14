import { NextRequest, NextResponse } from 'next/server';

const GITHUB_TOKEN = process.env.GITHUB_TOKEN ?? '';

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const owner = searchParams.get('owner');
  const repo = searchParams.get('repo');
  const path = searchParams.get('path');
  const branch = searchParams.get('branch');

  if (!owner || !repo || !path || !branch) {
    return NextResponse.json({ error: 'owner, repo, path, branch required' }, { status: 400 });
  }

  const res = await fetch(
    `https://api.github.com/repos/${owner}/${repo}/contents/${path}?ref=${branch}`,
    {
      headers: {
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
        ...(GITHUB_TOKEN ? { Authorization: `Bearer ${GITHUB_TOKEN}` } : {}),
      },
      next: { revalidate: 60 },
    },
  );

  if (!res.ok) return NextResponse.json({ error: 'not found' }, { status: 404 });

  const data = await res.json() as { content?: string };
  const content = Buffer.from(data.content ?? '', 'base64').toString('utf-8');
  return NextResponse.json({ content });
}
