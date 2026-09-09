import { useRef, useState, useEffect } from 'react';
import { Loader2 } from 'lucide-react';
import { exportConversationToPDF, exportMessageToPDF } from '@/shared/services/pdfExport';
import { exportConversationToDOCX, exportMessageToDOCX } from '@/shared/services/docxExport';
import { Message } from '@/shared/types';
import './ExportDropdown.css';

function PdfIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
      <rect x="1" y="1" width="12" height="12" rx="2" stroke="currentColor" strokeWidth="1.2"/>
      <path d="M4 7h3M4 9.5h6M4 4.5h6" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
    </svg>
  );
}

function DocxIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
      <rect x="1" y="1" width="12" height="12" rx="2" stroke="currentColor" strokeWidth="1.2"/>
      <path d="M3.5 5l1.5 4 1.5-4 1.5 4 1.5-4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

type ExportFormat = 'pdf' | 'docx';

interface ConversationProps {
  mode: 'conversation';
  messages: Message[];
  title?: string;
  children: (open: boolean, toggle: () => void) => React.ReactNode;
}

interface MessageProps {
  mode: 'message';
  content: string;
  provider?: string;
  timestamp?: string;
  title?: string;
  children: (open: boolean, toggle: () => void) => React.ReactNode;
}

type ExportDropdownProps = ConversationProps | MessageProps;

export default function ExportDropdown(props: ExportDropdownProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState<ExportFormat | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const toggle = () => setOpen((v) => !v);

  const handleExport = async (format: ExportFormat) => {
    if (loading) return;
    setLoading(format);
    setOpen(false);
    try {
      if (props.mode === 'conversation') {
        if (format === 'pdf') {
          await exportConversationToPDF({ messages: props.messages, title: props.title });
        } else {
          await exportConversationToDOCX({ messages: props.messages, title: props.title });
        }
      } else {
        if (format === 'pdf') {
          await exportMessageToPDF({
            content: props.content,
            provider: props.provider,
            timestamp: props.timestamp,
            title: props.title,
          });
        } else {
          await exportMessageToDOCX({
            content: props.content,
            provider: props.provider,
            timestamp: props.timestamp,
            title: props.title,
          });
        }
      }
    } finally {
      setLoading(null);
    }
  };

  return (
    <div className="export-dropdown" ref={ref}>
      {props.children(open, toggle)}

      {loading && (
        <span className="export-dropdown__loading-indicator" aria-label="Exporting…">
          <Loader2 size={12} className="spinning" />
        </span>
      )}

      {open && (
        <div className="export-dropdown__menu">
          <button
            className="export-dropdown__item"
            onClick={() => handleExport('pdf')}
            disabled={!!loading}
          >
            <PdfIcon />
            <span>Download (PDF)</span>
          </button>
          <button
            className="export-dropdown__item"
            onClick={() => handleExport('docx')}
            disabled={!!loading}
          >
            <DocxIcon />
            <span>Download (DOCX)</span>
          </button>
        </div>
      )}
    </div>
  );
}
