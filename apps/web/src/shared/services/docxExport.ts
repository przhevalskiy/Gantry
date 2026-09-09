import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
  AlignmentType,
  BorderStyle,
  Table,
  TableRow,
  TableCell,
  WidthType,
  ShadingType,
  Header,
  ImageRun,
} from 'docx';
import { saveAs } from 'file-saver';
import { Message } from '../types';

interface ExportOptions {
  content: string;
  provider?: string;
  timestamp?: string;
  title?: string;
}

interface ConversationExportOptions {
  messages: Message[];
  title?: string;
}

function stripMarkdown(text: string): string {
  return text
    .replace(/\*\*(.*?)\*\*/g, '$1')
    .replace(/\*(.*?)\*/g, '$1')
    .replace(/`(.*?)`/g, '$1')
    .replace(/\[(.*?)\]\((.*?)\)/g, '$1')
    .replace(/\[\d+\]/g, '')
    .trim();
}

function parseInlineRuns(text: string): TextRun[] {
  const runs: TextRun[] = [];
  const parts = text.split(/(\*\*.*?\*\*|\*.*?\*|`.*?`)/g);
  for (const part of parts) {
    if (!part) continue;
    if (part.startsWith('**') && part.endsWith('**')) {
      runs.push(new TextRun({ text: part.slice(2, -2), bold: true }));
    } else if (part.startsWith('*') && part.endsWith('*')) {
      runs.push(new TextRun({ text: part.slice(1, -1), italics: true }));
    } else if (part.startsWith('`') && part.endsWith('`')) {
      runs.push(new TextRun({ text: part.slice(1, -1), font: 'Courier New', size: 18 }));
    } else {
      const clean = part.replace(/\[\d+\]/g, '');
      if (clean) runs.push(new TextRun({ text: clean }));
    }
  }
  return runs.length ? runs : [new TextRun({ text: '' })];
}

function buildTable(tableLines: string[]): Table {
  const rows = tableLines
    .map(line => line.split('|').slice(1, -1).map(c => c.trim()))
    .filter(cells => cells.length > 0 && !cells.every(c => /^[-: ]+$/.test(c)));

  if (rows.length === 0) return new Table({ rows: [] });

  const colCount = Math.max(...rows.map(r => r.length));
  const colWidthPct = Math.floor(100 / colCount);

  const tableRows = rows.map((row, rowIdx) => {
    const isHeader = rowIdx === 0;
    const cells = Array.from({ length: colCount }, (_, ci) => {
      const cellText = row[ci] || '';
      return new TableCell({
        shading: isHeader
          ? { type: ShadingType.SOLID, color: 'EBF2FF' }
          : ci % 2 === 0 ? { type: ShadingType.SOLID, color: 'F8FAFF' } : undefined,
        width: { size: colWidthPct, type: WidthType.PERCENTAGE },
        children: [
          new Paragraph({
            children: [new TextRun({ text: stripMarkdown(cellText), bold: isHeader, size: 18 })],
          }),
        ],
        borders: {
          top:    { style: BorderStyle.SINGLE, size: 4, color: 'C5D5EA' },
          bottom: { style: BorderStyle.SINGLE, size: 4, color: 'C5D5EA' },
          left:   { style: BorderStyle.SINGLE, size: 4, color: 'C5D5EA' },
          right:  { style: BorderStyle.SINGLE, size: 4, color: 'C5D5EA' },
        },
      });
    });
    return new TableRow({ children: cells });
  });

  return new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows: tableRows });
}

function parseContentToDocx(content: string): Array<Paragraph | Table> {
  const elements: Array<Paragraph | Table> = [];
  const lines = content.split('\n');
  let inCodeBlock = false;
  let codeLines: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    if (trimmed.startsWith('```')) {
      if (!inCodeBlock) {
        inCodeBlock = true;
        codeLines = [];
      } else {
        inCodeBlock = false;
        if (codeLines.length > 0) {
          elements.push(
            new Paragraph({
              children: [new TextRun({ text: codeLines.join('\n'), font: 'Courier New', size: 18, color: '333333' })],
              shading: { type: ShadingType.SOLID, color: 'F5F5F5' },
              spacing: { before: 80, after: 80 },
            })
          );
        }
      }
      continue;
    }

    if (inCodeBlock) { codeLines.push(line); continue; }

    if (trimmed.startsWith('|') && trimmed.endsWith('|')) {
      const tableLines = [line];
      let j = i + 1;
      while (j < lines.length && lines[j].trim().startsWith('|')) {
        tableLines.push(lines[j]);
        j++;
      }
      i = j - 1;
      elements.push(buildTable(tableLines));
      elements.push(new Paragraph({ text: '', spacing: { after: 80 } }));
      continue;
    }

    if (/^[-*_]{3,}$/.test(trimmed)) {
      elements.push(new Paragraph({
        border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: 'CCCCCC' } },
        spacing: { before: 120, after: 120 },
        children: [],
      }));
      continue;
    }

    if (trimmed.startsWith('#### ')) {
      elements.push(new Paragraph({ text: stripMarkdown(trimmed.replace(/^####\s*/, '')), heading: HeadingLevel.HEADING_4, spacing: { before: 120, after: 60 } }));
      continue;
    }
    if (trimmed.startsWith('### ')) {
      elements.push(new Paragraph({ text: stripMarkdown(trimmed.replace(/^###\s*/, '')), heading: HeadingLevel.HEADING_3, spacing: { before: 160, after: 80 } }));
      continue;
    }
    if (trimmed.startsWith('## ')) {
      elements.push(new Paragraph({ text: stripMarkdown(trimmed.replace(/^##\s*/, '')), heading: HeadingLevel.HEADING_2, spacing: { before: 200, after: 100 } }));
      continue;
    }
    if (trimmed.startsWith('# ')) {
      elements.push(new Paragraph({ text: stripMarkdown(trimmed.replace(/^#\s*/, '')), heading: HeadingLevel.HEADING_1, spacing: { before: 240, after: 120 } }));
      continue;
    }

    const bulletMatch = line.match(/^(\s*)([-*•●◦▪])\s+(.*)$/);
    if (bulletMatch) {
      const indentLevel = Math.floor((bulletMatch[1]?.length || 0) / 2);
      elements.push(new Paragraph({ children: parseInlineRuns(bulletMatch[3]), bullet: { level: indentLevel }, spacing: { after: 40 } }));
      continue;
    }

    const numberedMatch = line.match(/^(\s*)(\d+)\.\s+(.*)$/);
    if (numberedMatch) {
      elements.push(new Paragraph({ children: parseInlineRuns(numberedMatch[3]), numbering: { reference: 'default-numbering', level: 0 }, spacing: { after: 40 } }));
      continue;
    }

    if (trimmed === '') {
      elements.push(new Paragraph({ text: '', spacing: { after: 60 } }));
      continue;
    }

    elements.push(new Paragraph({ children: parseInlineRuns(line), spacing: { after: 80 } }));
  }

  return elements;
}

function messageSeparator(): Paragraph {
  return new Paragraph({
    border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: 'E0E0E0' } },
    spacing: { before: 160, after: 160 },
    children: [],
  });
}

function roleLabel(label: string, isUser: boolean): Paragraph {
  return new Paragraph({
    children: [new TextRun({ text: label, bold: true, color: isUser ? '3B82F6' : '10B981', size: 24 })],
    spacing: { after: 100 },
  });
}

async function loadLogoArrayBuffer(): Promise<ArrayBuffer | null> {
  try {
    const res = await fetch('/gantry-logo.png');
    if (!res.ok) return null;
    return await res.arrayBuffer();
  } catch {
    return null;
  }
}

function buildDocumentHeader(logoBuffer: ArrayBuffer | null, title: string): Header {
  const headerChildren: (Paragraph | Table)[] = [];

  if (logoBuffer) {
    headerChildren.push(
      new Paragraph({
        children: [
          new ImageRun({ data: logoBuffer, transformation: { width: 36, height: 36 }, type: 'png' }),
          new TextRun({ text: '  Gantry', bold: true, size: 26, color: '1E1E1E' }),
        ],
        spacing: { after: 80 },
      })
    );
  } else {
    headerChildren.push(
      new Paragraph({ children: [new TextRun({ text: title, bold: true, size: 26 })], spacing: { after: 80 } })
    );
  }

  headerChildren.push(
    new Paragraph({
      border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: 'D2D7E1' } },
      children: [],
      spacing: { after: 120 },
    })
  );

  return new Header({ children: headerChildren });
}

export async function exportMessageToDOCX({
  content,
  provider,
  timestamp,
  title = 'Gantry Response',
}: ExportOptions): Promise<void> {
  const logoBuffer = await loadLogoArrayBuffer();
  const header = buildDocumentHeader(logoBuffer, title);

  const metaParts: string[] = [];
  if (provider) metaParts.push(`Provider: ${provider}`);
  metaParts.push(`Exported: ${new Date(timestamp || Date.now()).toLocaleString()}`);

  const doc = new Document({
    numbering: {
      config: [{ reference: 'default-numbering', levels: [{ level: 0, format: 'decimal', text: '%1.', alignment: AlignmentType.LEFT }] }],
    },
    sections: [
      {
        headers: { default: header },
        children: [
          new Paragraph({ text: title, heading: HeadingLevel.HEADING_1, spacing: { after: 80 } }),
          new Paragraph({ children: [new TextRun({ text: metaParts.join('  |  '), color: '888888', size: 18 })], spacing: { after: 160 } }),
          ...parseContentToDocx(content),
        ],
      },
    ],
  });

  const buffer = await Packer.toBlob(doc);
  const dateStr = new Date().toISOString().split('T')[0];
  saveAs(buffer, `gantry-response-${dateStr}.docx`);
}

export async function exportConversationToDOCX({
  messages,
  title = 'Gantry Conversation',
}: ConversationExportOptions): Promise<void> {
  const logoBuffer = await loadLogoArrayBuffer();
  const header = buildDocumentHeader(logoBuffer, title);

  const children: Array<Paragraph | Table> = [
    new Paragraph({ text: title, heading: HeadingLevel.HEADING_1, spacing: { after: 80 } }),
    new Paragraph({
      children: [new TextRun({ text: `Exported: ${new Date().toLocaleString()}  |  Messages: ${messages.length}`, color: '888888', size: 18 })],
      spacing: { after: 200 },
    }),
  ];

  for (let i = 0; i < messages.length; i++) {
    const msg = messages[i];
    const isUser = msg.role === 'user';
    const label = isUser ? 'You:' : 'Gantry:';

    children.push(roleLabel(label, isUser));
    children.push(...parseContentToDocx(msg.content));

    if (i < messages.length - 1) {
      children.push(messageSeparator());
    }
  }

  const doc = new Document({
    numbering: {
      config: [{ reference: 'default-numbering', levels: [{ level: 0, format: 'decimal', text: '%1.', alignment: AlignmentType.LEFT }] }],
    },
    sections: [{ headers: { default: header }, children }],
  });

  const buffer = await Packer.toBlob(doc);
  const dateStr = new Date().toISOString().split('T')[0];
  const titleSlug = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 30);
  saveAs(buffer, `gantry-${titleSlug}-${dateStr}.docx`);
}
