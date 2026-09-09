import jsPDF from 'jspdf';
import { Message, Discussion } from '../types';

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

interface DocumentExportOptions {
  filename: string;
  fullContent: string;
  chunks?: Array<{
    id: string;
    content: string;
    chunk_index: number;
    content_type?: string;
  }>;
}

async function loadLogoBase64(): Promise<string | null> {
  try {
    const response = await fetch('/gantry-logo.png');
    if (!response.ok) return null;
    const blob = await response.blob();
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

const LOGO_SIZE = 11;
const LOGO_Y = 4;
const HEADER_LINE_Y = 21;
const PAGE_CONTENT_Y = 33;

function addLogoToPages(pdf: jsPDF, logoBase64: string, pageWidth: number, totalPages: number): void {
  const logoX = 20;

  for (let i = 1; i <= totalPages; i++) {
    pdf.setPage(i);
    pdf.addImage(logoBase64, 'PNG', logoX, LOGO_Y, LOGO_SIZE, LOGO_SIZE);
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(17);
    pdf.setTextColor(30, 30, 30);
    pdf.text('Gantry', logoX + LOGO_SIZE + 3, LOGO_Y + LOGO_SIZE / 2 + 2.5);
    pdf.setDrawColor(210, 215, 225);
    pdf.setLineWidth(0.4);
    pdf.line(20, HEADER_LINE_Y, pageWidth - 20, HEADER_LINE_Y);
    pdf.setLineWidth(0.2);
    pdf.setDrawColor(200, 200, 200);
  }
}

function cleanMarkdownText(text: string): string {
  return text
    .replace(/\*\*(.*?)\*\*/g, '$1')
    .replace(/\*(.*?)\*/g, '$1')
    .replace(/`(.*?)`/g, '$1')
    .replace(/\[(.*?)\]\((.*?)\)/g, '$1')
    .replace(/\[\d+\]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function getIndentLevel(line: string): number {
  const match = line.match(/^(\s*)/);
  if (!match) return 0;
  return Math.floor(match[1].length / 2);
}

function drawBulletDot(pdf: jsPDF, x: number, y: number, level: number): void {
  const dotY = y - 1.3;
  pdf.setFillColor(0, 0, 0);
  pdf.setDrawColor(0, 0, 0);
  if (level === 0) {
    pdf.circle(x, dotY, 1.1, 'F');
  } else if (level === 1) {
    pdf.circle(x, dotY, 0.9, 'DF');
  } else {
    pdf.rect(x - 0.8, dotY - 0.8, 1.6, 1.6, 'F');
  }
}

function renderTable(
  pdf: jsPDF,
  tableLines: string[],
  margin: number,
  contentWidth: number,
  yPosition: number,
  pageHeight: number
): number {
  const rows = tableLines
    .map(line => line.split('|').slice(1, -1).map(cell => cell.trim()))
    .filter(cells => cells.length > 0 && !cells.every(cell => /^[-: ]+$/.test(cell)));

  if (rows.length === 0) return yPosition;

  const colCount = Math.max(...rows.map(r => r.length));
  const colWidth = contentWidth / colCount;
  const cellPadH = 2;
  const cellPadV = 1.5;
  const lineHeight = 4.5;
  const fontSize = 9;

  pdf.setFontSize(fontSize);

  for (let rowIdx = 0; rowIdx < rows.length; rowIdx++) {
    const isHeader = rowIdx === 0;
    const row = rows[rowIdx];

    let maxLines = 1;
    pdf.setFont('helvetica', isHeader ? 'bold' : 'normal');
    pdf.setFontSize(fontSize);
    for (let colIdx = 0; colIdx < colCount; colIdx++) {
      const cellText = row[colIdx] || '';
      const wrapped = pdf.splitTextToSize(cleanMarkdownText(cellText), colWidth - cellPadH * 2);
      maxLines = Math.max(maxLines, wrapped.length);
    }
    const rowHeight = maxLines * lineHeight + cellPadV * 2;

    if (yPosition + rowHeight > pageHeight - margin - 15) {
      pdf.addPage();
      yPosition = PAGE_CONTENT_Y;
    }

    if (isHeader) {
      pdf.setFillColor(235, 242, 255);
      pdf.rect(margin, yPosition, contentWidth, rowHeight, 'F');
    } else if (rowIdx % 2 === 0) {
      pdf.setFillColor(250, 251, 255);
      pdf.rect(margin, yPosition, contentWidth, rowHeight, 'F');
    }

    pdf.setDrawColor(180, 200, 230);
    for (let colIdx = 0; colIdx < colCount; colIdx++) {
      const cellX = margin + colIdx * colWidth;
      const cellText = row[colIdx] || '';

      pdf.rect(cellX, yPosition, colWidth, rowHeight);
      pdf.setFont('helvetica', isHeader ? 'bold' : 'normal');
      pdf.setFontSize(fontSize);
      pdf.setTextColor(0, 0, 0);

      const wrapped = pdf.splitTextToSize(cleanMarkdownText(cellText), colWidth - cellPadH * 2);
      for (let lineIdx = 0; lineIdx < wrapped.length; lineIdx++) {
        pdf.text(
          wrapped[lineIdx],
          cellX + cellPadH,
          yPosition + cellPadV + lineHeight * (lineIdx + 0.8)
        );
      }
    }

    yPosition += rowHeight;
  }

  pdf.setDrawColor(200, 200, 200);
  return yPosition + 4;
}

function renderContentToPDF(
  pdf: jsPDF,
  content: string,
  margin: number,
  contentWidth: number,
  pageHeight: number,
  startY: number,
  pageTopY: number = PAGE_CONTENT_Y
): number {
  let yPosition = startY;
  let inCodeBlock = false;
  let codeBlockContent: string[] = [];

  const checkPageBreak = (height: number) => {
    if (yPosition + height > pageHeight - margin - 15) {
      pdf.addPage();
      yPosition = pageTopY;
    }
  };

  const lines = content.split('\n');

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmedLine = line.trim();

    if (trimmedLine.startsWith('```')) {
      if (!inCodeBlock) {
        inCodeBlock = true;
        codeBlockContent = [];
        continue;
      } else {
        inCodeBlock = false;
        if (codeBlockContent.length > 0) {
          checkPageBreak(codeBlockContent.length * 4 + 6);
          const blockHeight = codeBlockContent.length * 4 + 4;
          pdf.setFillColor(245, 245, 245);
          pdf.rect(margin, yPosition - 2, contentWidth, blockHeight, 'F');
          pdf.setFont('courier', 'normal');
          pdf.setFontSize(9);
          pdf.setTextColor(50, 50, 50);
          for (const codeLine of codeBlockContent) {
            const wrappedCode = pdf.splitTextToSize(codeLine, contentWidth - 6);
            for (const wrappedCodeLine of wrappedCode) {
              pdf.text(wrappedCodeLine, margin + 3, yPosition + 2);
              yPosition += 4;
            }
          }
          yPosition += 4;
          pdf.setFont('helvetica', 'normal');
          pdf.setFontSize(11);
          pdf.setTextColor(0, 0, 0);
        }
        continue;
      }
    }

    if (inCodeBlock) {
      codeBlockContent.push(line);
      continue;
    }

    if (trimmedLine.startsWith('|') && trimmedLine.endsWith('|')) {
      const tableLines = [line];
      let j = i + 1;
      while (j < lines.length && lines[j].trim().startsWith('|')) {
        tableLines.push(lines[j]);
        j++;
      }
      i = j - 1;
      yPosition = renderTable(pdf, tableLines, margin, contentWidth, yPosition, pageHeight);
      continue;
    }

    if (/^[-*_]{3,}$/.test(trimmedLine)) {
      checkPageBreak(8);
      yPosition += 3;
      pdf.setDrawColor(200, 200, 200);
      pdf.line(margin, yPosition, margin + contentWidth, yPosition);
      yPosition += 5;
      continue;
    }

    if (trimmedLine.startsWith('#### ')) {
      checkPageBreak(10);
      yPosition += 4;
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(11);
      const headerText = cleanMarkdownText(trimmedLine.replace(/^####\s*/, ''));
      const wrappedHeaders = pdf.splitTextToSize(headerText, contentWidth);
      for (const wrappedHeader of wrappedHeaders) {
        pdf.text(wrappedHeader, margin, yPosition);
        yPosition += 5;
      }
      yPosition += 2;
      pdf.setFont('helvetica', 'normal');
      continue;
    }

    if (trimmedLine.startsWith('### ')) {
      checkPageBreak(12);
      yPosition += 5;
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(12);
      const headerText = cleanMarkdownText(trimmedLine.replace(/^###\s*/, ''));
      const wrappedHeaders = pdf.splitTextToSize(headerText, contentWidth);
      for (const wrappedHeader of wrappedHeaders) {
        pdf.text(wrappedHeader, margin, yPosition);
        yPosition += 6;
      }
      yPosition += 2;
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(11);
      continue;
    }

    if (trimmedLine.startsWith('## ')) {
      checkPageBreak(14);
      yPosition += 6;
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(14);
      const headerText = cleanMarkdownText(trimmedLine.replace(/^##\s*/, ''));
      const wrappedHeaders = pdf.splitTextToSize(headerText, contentWidth);
      for (const wrappedHeader of wrappedHeaders) {
        pdf.text(wrappedHeader, margin, yPosition);
        yPosition += 7;
      }
      yPosition += 3;
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(11);
      continue;
    }

    if (trimmedLine.startsWith('# ')) {
      checkPageBreak(16);
      yPosition += 7;
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(16);
      const headerText = cleanMarkdownText(trimmedLine.replace(/^#\s*/, ''));
      const wrappedHeaders = pdf.splitTextToSize(headerText, contentWidth);
      for (const wrappedHeader of wrappedHeaders) {
        pdf.text(wrappedHeader, margin, yPosition);
        yPosition += 8;
      }
      yPosition += 3;
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(11);
      continue;
    }

    const bulletMatch = line.match(/^(\s*)([-*•●◦▪–])\s+(.*)$/) ||
                        line.match(/^(\s*)(•|●|○|–)\s+(.*)$/);

    if (bulletMatch) {
      const indentLevel = getIndentLevel(line);
      const indent = indentLevel * 5;
      const itemText = cleanMarkdownText(bulletMatch[3] || bulletMatch[bulletMatch.length - 1]);

      checkPageBreak(6);
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(11);
      pdf.setTextColor(0, 0, 0);

      const wrappedLines = pdf.splitTextToSize(itemText, contentWidth - indent - 8);

      for (let j = 0; j < wrappedLines.length; j++) {
        checkPageBreak(5);
        if (j === 0) {
          drawBulletDot(pdf, margin + indent + 1.5, yPosition, indentLevel);
          pdf.text(wrappedLines[j], margin + indent + 5, yPosition);
        } else {
          pdf.text(wrappedLines[j], margin + indent + 5, yPosition);
        }
        yPosition += 5;
      }
      continue;
    }

    const numberedMatch = line.match(/^(\s*)(\d+)\.\s+(.*)$/);

    if (numberedMatch) {
      const indentLevel = getIndentLevel(line);
      const indent = indentLevel * 5;
      const number = numberedMatch[2];
      const itemText = cleanMarkdownText(numberedMatch[3]);

      checkPageBreak(6);
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(11);
      pdf.setTextColor(0, 0, 0);

      const wrappedLines = pdf.splitTextToSize(itemText, contentWidth - indent - 10);

      for (let j = 0; j < wrappedLines.length; j++) {
        checkPageBreak(5);
        if (j === 0) {
          pdf.text(`${number}.`, margin + indent, yPosition);
          pdf.text(wrappedLines[j], margin + indent + 7, yPosition);
        } else {
          pdf.text(wrappedLines[j], margin + indent + 7, yPosition);
        }
        yPosition += 5;
      }
      continue;
    }

    if (trimmedLine === '') {
      yPosition += 3;
      continue;
    }

    if (trimmedLine.startsWith('**') && trimmedLine.endsWith('**') && !trimmedLine.slice(2, -2).includes('**')) {
      checkPageBreak(6);
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(11);
      const boldText = trimmedLine.slice(2, -2);
      const wrappedLines = pdf.splitTextToSize(boldText, contentWidth);
      for (const wrappedLine of wrappedLines) {
        checkPageBreak(5);
        pdf.text(wrappedLine, margin, yPosition);
        yPosition += 5;
      }
      pdf.setFont('helvetica', 'normal');
      continue;
    }

    checkPageBreak(6);
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(11);
    pdf.setTextColor(0, 0, 0);

    const cleanLine = cleanMarkdownText(line);
    if (cleanLine) {
      const wrappedLines = pdf.splitTextToSize(cleanLine, contentWidth);
      for (const wrappedLine of wrappedLines) {
        checkPageBreak(5);
        pdf.text(wrappedLine, margin, yPosition);
        yPosition += 5;
      }
    }
  }

  return yPosition;
}

export async function exportMessageToPDF({
  content,
  provider,
  timestamp,
  title = 'Gantry Response',
}: ExportOptions): Promise<void> {
  const logoBase64 = await loadLogoBase64();

  const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const margin = 20;
  const contentWidth = pageWidth - margin * 2;
  let yPosition = PAGE_CONTENT_Y;

  pdf.setFontSize(18);
  pdf.setFont('helvetica', 'bold');
  pdf.text(title, margin, yPosition);
  yPosition += 10;

  pdf.setFontSize(10);
  pdf.setFont('helvetica', 'normal');
  pdf.setTextColor(128, 128, 128);

  const metaParts: string[] = [];
  if (provider) metaParts.push(`Provider: ${provider}`);
  metaParts.push(timestamp
    ? `Generated: ${new Date(timestamp).toLocaleString()}`
    : `Exported: ${new Date().toLocaleString()}`
  );

  pdf.text(metaParts.join('  |  '), margin, yPosition);
  yPosition += 8;

  pdf.setDrawColor(200, 200, 200);
  pdf.line(margin, yPosition, pageWidth - margin, yPosition);
  yPosition += 10;

  pdf.setTextColor(0, 0, 0);
  renderContentToPDF(pdf, content, margin, contentWidth, pageHeight, yPosition);

  const totalPages = pdf.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    pdf.setPage(i);
    pdf.setFontSize(9);
    pdf.setTextColor(150, 150, 150);
    pdf.text(`Generated by Gantry  |  Page ${i} of ${totalPages}`, pageWidth / 2, pageHeight - 10, { align: 'center' });
  }

  if (logoBase64) addLogoToPages(pdf, logoBase64, pageWidth, totalPages);

  const dateStr = new Date().toISOString().split('T')[0];
  pdf.save(`gantry-response-${dateStr}.pdf`);
}

export async function exportConversationToPDF({
  messages,
  title = 'Gantry Conversation',
}: ConversationExportOptions): Promise<void> {
  const logoBase64 = await loadLogoBase64();

  const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const margin = 20;
  const contentWidth = pageWidth - margin * 2;
  let yPosition = PAGE_CONTENT_Y;

  const checkPageBreak = (height: number) => {
    if (yPosition + height > pageHeight - margin - 15) {
      pdf.addPage();
      yPosition = PAGE_CONTENT_Y;
    }
  };

  pdf.setFontSize(18);
  pdf.setFont('helvetica', 'bold');
  pdf.text(title, margin, yPosition);
  yPosition += 10;

  pdf.setFontSize(10);
  pdf.setFont('helvetica', 'normal');
  pdf.setTextColor(128, 128, 128);
  pdf.text(`Exported: ${new Date().toLocaleString()}  |  Messages: ${messages.length}`, margin, yPosition);
  yPosition += 8;

  pdf.setDrawColor(200, 200, 200);
  pdf.line(margin, yPosition, pageWidth - margin, yPosition);
  yPosition += 12;

  for (let i = 0; i < messages.length; i++) {
    const message = messages[i];
    checkPageBreak(15);

    pdf.setFontSize(12);
    pdf.setFont('helvetica', 'bold');

    if (message.role === 'user') {
      pdf.setTextColor(59, 130, 246);
      pdf.text('You:', margin, yPosition);
    } else {
      pdf.setTextColor(16, 185, 129);
      pdf.text('Gantry:', margin, yPosition);
    }

    yPosition += 8;
    pdf.setTextColor(0, 0, 0);
    yPosition = renderContentToPDF(pdf, message.content, margin + 3, contentWidth - 3, pageHeight, yPosition);
    yPosition += 6;

    if (i < messages.length - 1) {
      checkPageBreak(8);
      pdf.setDrawColor(220, 220, 220);
      pdf.line(margin + 10, yPosition, pageWidth - margin - 10, yPosition);
      yPosition += 8;
    }
  }

  const totalPages = pdf.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    pdf.setPage(i);
    pdf.setFontSize(9);
    pdf.setTextColor(150, 150, 150);
    pdf.text(`Generated by Gantry  |  Page ${i} of ${totalPages}`, pageWidth / 2, pageHeight - 10, { align: 'center' });
  }

  if (logoBase64) addLogoToPages(pdf, logoBase64, pageWidth, totalPages);

  const dateStr = new Date().toISOString().split('T')[0];
  const titleSlug = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 30);
  pdf.save(`gantry-${titleSlug}-${dateStr}.pdf`);
}

export async function exportHistoryToPDF(discussions: Discussion[]): Promise<void> {
  const logoBase64 = await loadLogoBase64();

  const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const margin = 20;
  const contentWidth = pageWidth - margin * 2;
  let yPosition = PAGE_CONTENT_Y;

  const checkPageBreak = (height: number) => {
    if (yPosition + height > pageHeight - margin - 15) {
      pdf.addPage();
      yPosition = PAGE_CONTENT_Y;
    }
  };

  pdf.setFontSize(18);
  pdf.setFont('helvetica', 'bold');
  pdf.setTextColor(30, 30, 30);
  pdf.text('Discussion History', margin, yPosition);
  yPosition += 10;

  pdf.setFontSize(10);
  pdf.setFont('helvetica', 'normal');
  pdf.setTextColor(128, 128, 128);
  pdf.text(`Exported: ${new Date().toLocaleString()}  |  Total: ${discussions.length}`, margin, yPosition);
  yPosition += 8;

  pdf.setDrawColor(200, 200, 200);
  pdf.setLineWidth(0.4);
  pdf.line(margin, yPosition, pageWidth - margin, yPosition);
  pdf.setLineWidth(0.2);
  yPosition += 12;

  const baseUrl = window.location.origin;

  for (let i = 0; i < discussions.length; i++) {
    const d = discussions[i];
    checkPageBreak(28);

    pdf.setFontSize(12);
    pdf.setFont('helvetica', 'bold');
    pdf.setTextColor(30, 30, 30);
    const titleText = d.title || 'Untitled';
    const wrappedTitle = pdf.splitTextToSize(`${i + 1}. ${titleText}`, contentWidth);
    for (const line of wrappedTitle) {
      checkPageBreak(6);
      pdf.text(line, margin, yPosition);
      yPosition += 6;
    }

    pdf.setFontSize(9);
    pdf.setFont('helvetica', 'normal');
    pdf.setTextColor(120, 120, 120);
    const created = new Date(d.created_at).toLocaleString();
    const updated = new Date(d.updated_at).toLocaleString();
    pdf.text(`Created: ${created}  |  Last updated: ${updated}`, margin + 4, yPosition);
    yPosition += 5;

    pdf.setTextColor(59, 130, 246);
    pdf.text(`${baseUrl}/chat/${d.id}`, margin + 4, yPosition);
    yPosition += 10;

    if (i < discussions.length - 1) {
      checkPageBreak(6);
      pdf.setDrawColor(230, 230, 230);
      pdf.line(margin, yPosition - 4, pageWidth - margin, yPosition - 4);
    }
  }

  const totalPages = pdf.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    pdf.setPage(i);
    pdf.setFontSize(9);
    pdf.setTextColor(150, 150, 150);
    pdf.text(`Generated by Gantry  |  Page ${i} of ${totalPages}`, pageWidth / 2, pageHeight - 10, { align: 'center' });
  }

  if (logoBase64) addLogoToPages(pdf, logoBase64, pageWidth, totalPages);

  const dateStr = new Date().toISOString().split('T')[0];
  pdf.save(`gantry-history-${dateStr}.pdf`);
}
