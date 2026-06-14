'use client';

import { useState } from 'react';
import { DocTree } from './doc-tree';
import { DocContent } from './doc-content';

export function DocsPage() {
  const [activeSlug, setActiveSlug] = useState('introduction');

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>
      <DocTree activeSlug={activeSlug} onSelect={setActiveSlug} />
      <DocContent activeSlug={activeSlug} />
    </div>
  );
}
