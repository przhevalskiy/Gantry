'use client';

import { useRef, useState, useEffect } from 'react';
import { useFileAttachments, buildAttachmentBlock, type AttachedFile } from '@/hooks/use-file-attachments';

export type { AttachedFile };
export { buildAttachmentBlock };

const ACCENT = '#f97316';

function IconFile() {
  return (
    <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
      <polyline points="14 2 14 8 20 8"/>
    </svg>
  );
}

function IconWrench() {
  return (
    <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/>
    </svg>
  );
}

// Hook — call this in the parent (index.tsx) and pass result as props
export function useContextBuilder() {
  const { files: attachedFiles, error: attachError, addFiles, removeFile, clearAll: clearFiles } = useFileAttachments();
  const [fileDragging, setFileDragging] = useState(false);

  const [fileDropdownOpen, setFileDropdownOpen] = useState(false);
  const fileDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!fileDropdownOpen) return;
    const h = (e: MouseEvent) => {
      if (fileDropdownRef.current && !fileDropdownRef.current.contains(e.target as Node)) {
        setFileDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [fileDropdownOpen]);

  return {
    attachedFiles,
    attachError,
    addFiles,
    removeFile,
    clearFiles,
    fileDragging,
    setFileDragging,
    fileDropdownOpen,
    setFileDropdownOpen,
    fileDropdownRef,
  };
}

// File chips shown above the text input when files are attached
export function FileChips({
  attachedFiles,
  removeFile,
}: {
  attachedFiles: AttachedFile[];
  removeFile: (i: number) => void;
}) {
  if (attachedFiles.length === 0) return null;
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.375rem', padding: '0.625rem 1rem 0 4rem' }}>
      {attachedFiles.map((f, i) => (
        <div key={i} style={{
          display: 'flex', alignItems: 'center', gap: '0.3rem',
          background: 'var(--surface-raised)', border: '1px solid var(--border)',
          borderRadius: '6px', padding: '0.2rem 0.5rem',
          fontSize: '0.72rem', color: 'var(--text-secondary)', maxWidth: '200px',
        }}>
          <IconFile />
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.name}</span>
          <span style={{ opacity: 0.5, fontSize: '0.65rem', flexShrink: 0 }}>
            {f.size > 1000 ? `${(f.size / 1000).toFixed(0)}k` : `${f.size}b`}
          </span>
          <button type="button" onClick={() => removeFile(i)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, color: 'var(--text-secondary)', lineHeight: 1 }}>✕</button>
        </div>
      ))}
    </div>
  );
}

// Wrench button + dropdown panel for file attachment
export function ContextBuilderButton({
  attachedFiles,
  addFiles,
  removeFile,
  clearFiles,
  isPending,
  fileDropdownOpen,
  setFileDropdownOpen,
  fileDropdownRef,
}: {
  attachedFiles: AttachedFile[];
  addFiles: (files: FileList | File[]) => void;
  removeFile: (i: number) => void;
  clearFiles: () => void;
  isPending: boolean;
  fileDropdownOpen: boolean;
  setFileDropdownOpen: (v: boolean | ((prev: boolean) => boolean)) => void;
  fileDropdownRef: React.RefObject<HTMLDivElement | null>;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  return (
    <>
      <input
        ref={fileInputRef}
        type="file"
        multiple
        style={{ display: 'none' }}
        onChange={e => { if (e.target.files) { addFiles(e.target.files); e.target.value = ''; } }}
      />

      <div ref={fileDropdownRef} style={{ position: 'relative' }}>
        <button
          type="button"
          onClick={() => setFileDropdownOpen(!fileDropdownOpen)}
          disabled={isPending}
          title="Attach files to context"
          style={{
            background: 'none',
            border: `1px solid ${attachedFiles.length ? ACCENT : 'var(--border)'}`,
            borderRadius: '50%', padding: '5px', cursor: 'pointer',
            color: attachedFiles.length ? ACCENT : 'var(--text-secondary)',
            opacity: attachedFiles.length ? 1 : 0.5,
            display: 'flex', transition: 'color 0.12s, opacity 0.12s, border-color 0.12s',
          }}
          onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.opacity = '1'; }}
          onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.opacity = attachedFiles.length ? '1' : '0.5'; }}
        >
          <IconWrench />
        </button>

        {fileDropdownOpen && (
          <div style={{
            position: 'absolute', top: 'calc(100% + 8px)', left: 0,
            background: 'var(--surface)', border: '1px solid var(--border)',
            borderRadius: '12px', overflow: 'hidden',
            boxShadow: '0 8px 32px rgba(0,0,0,0.18)',
            zIndex: 200, width: '260px',
          }}>
            {/* Drop zone */}
            <div
              onDragOver={e => e.preventDefault()}
              onDrop={e => { e.preventDefault(); if (e.dataTransfer.files.length) addFiles(e.dataTransfer.files); }}
              onClick={() => fileInputRef.current?.click()}
              style={{
                padding: '1rem',
                borderBottom: '1px solid var(--border)',
                cursor: 'pointer',
                background: 'var(--surface-raised)',
                textAlign: 'center',
                transition: 'background 0.12s',
              }}
            >
              <p style={{ margin: 0, fontSize: '0.8125rem', fontWeight: 500, color: 'var(--text-primary)' }}>
                Drop files or click to browse
              </p>
              <p style={{ margin: '0.25rem 0 0', fontSize: '0.7rem', color: 'var(--text-secondary)' }}>
                Text, code, JSON — up to 100 KB
              </p>
            </div>

            {/* File list */}
            {attachedFiles.length > 0 ? (
              <div style={{ maxHeight: '160px', overflowY: 'auto' }}>
                {attachedFiles.map((f, i) => (
                  <div key={i} style={{
                    display: 'flex', alignItems: 'center', gap: '0.5rem',
                    padding: '0.5rem 0.75rem',
                    borderBottom: i < attachedFiles.length - 1 ? '1px solid var(--border)' : 'none',
                  }}>
                    <IconFile />
                    <span style={{ flex: 1, fontSize: '0.78rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.name}</span>
                    <span style={{ fontSize: '0.68rem', color: 'var(--text-secondary)', flexShrink: 0 }}>
                      {f.size > 1000 ? `${(f.size / 1000).toFixed(0)}k` : `${f.size}b`}
                    </span>
                    <button type="button" onClick={() => removeFile(i)}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, color: 'var(--text-secondary)', lineHeight: 1, fontSize: '0.78rem' }}>✕</button>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ padding: '0.625rem 0.75rem' }}>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>No files attached</span>
              </div>
            )}

            {/* Footer */}
            {attachedFiles.length > 0 && (
              <div style={{ padding: '0.5rem 0.75rem', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>
                  {attachedFiles.length} file{attachedFiles.length > 1 ? 's' : ''}
                </span>
                <button type="button" onClick={clearFiles}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.7rem', color: 'var(--text-secondary)', fontFamily: 'inherit' }}>
                  Clear all
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </>
  );
}
