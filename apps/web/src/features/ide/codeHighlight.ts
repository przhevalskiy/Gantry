import hljs from 'highlight.js/lib/core';
import typescript from 'highlight.js/lib/languages/typescript';
import javascript from 'highlight.js/lib/languages/javascript';
import python from 'highlight.js/lib/languages/python';
import xml from 'highlight.js/lib/languages/xml';
import css from 'highlight.js/lib/languages/css';
import json from 'highlight.js/lib/languages/json';
import bash from 'highlight.js/lib/languages/bash';
import yaml from 'highlight.js/lib/languages/yaml';
import markdown from 'highlight.js/lib/languages/markdown';
import dockerfile from 'highlight.js/lib/languages/dockerfile';

hljs.registerLanguage('typescript', typescript);
hljs.registerLanguage('tsx', typescript);
hljs.registerLanguage('javascript', javascript);
hljs.registerLanguage('jsx', javascript);
hljs.registerLanguage('python', python);
hljs.registerLanguage('xml', xml);
hljs.registerLanguage('html', xml);
hljs.registerLanguage('css', css);
hljs.registerLanguage('json', json);
hljs.registerLanguage('bash', bash);
hljs.registerLanguage('sh', bash);
hljs.registerLanguage('yaml', yaml);
hljs.registerLanguage('yml', yaml);
hljs.registerLanguage('markdown', markdown);
hljs.registerLanguage('md', markdown);
hljs.registerLanguage('dockerfile', dockerfile);

const EXT_TO_LANG: Record<string, string> = {
  ts: 'typescript',
  tsx: 'tsx',
  js: 'javascript',
  jsx: 'jsx',
  py: 'python',
  html: 'html',
  htm: 'html',
  css: 'css',
  json: 'json',
  sh: 'bash',
  bash: 'bash',
  yaml: 'yaml',
  yml: 'yaml',
  md: 'markdown',
  dockerfile: 'dockerfile',
};

export function languageForPath(relPath: string): string | null {
  const ext = (relPath.split('/').pop() ?? relPath).split('.').pop()?.toLowerCase() ?? '';
  return EXT_TO_LANG[ext] ?? null;
}

export function highlightCode(content: string, relPath: string): string | null {
  const lang = languageForPath(relPath);
  if (!lang || !content) return null;
  try {
    return hljs.highlight(content, { language: lang }).value;
  } catch {
    return null;
  }
}

export function languageLabel(relPath: string): string {
  const lang = languageForPath(relPath);
  if (lang) return lang.toUpperCase();
  const ext = (relPath.split('/').pop() ?? relPath).split('.').pop()?.toUpperCase() ?? '';
  return ext || 'TEXT';
}
