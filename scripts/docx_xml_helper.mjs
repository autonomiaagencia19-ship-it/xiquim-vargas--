import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';

const manualsDir = path.resolve('xiquimvargasmanuais');
if (!fs.existsSync(manualsDir)) fs.mkdirSync(manualsDir, { recursive: true });

function escapeXml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

// Converte markdown em fragmentos de OpenXML WordProcessingML
export function mdToDocxBody(mdContent, docTitle = '') {
  const lines = mdContent.split(/\r?\n/);
  const xmlParts = [];

  let inTable = false;
  let tableRows = [];

  function flushTable() {
    if (!tableRows.length) return;
    xmlParts.push('<w:tbl>');
    xmlParts.push('<w:tblPr><w:tblStyle w:val="TableGrid"/><w:tblW w:w="0" w:type="auto"/><w:tblLook w:val="04A0"/></w:tblPr>');
    for (let r = 0; r < tableRows.length; r++) {
      const row = tableRows[r];
      const isHeader = r === 0;
      xmlParts.push('<w:tr>');
      for (const cell of row) {
        xmlParts.push('<w:tc>');
        xmlParts.push('<w:tcPr>');
        if (isHeader) {
          xmlParts.push('<w:shd w:val="clear" w:color="auto" w:fill="061A4F"/>');
        } else {
          xmlParts.push('<w:shd w:val="clear" w:color="auto" w:fill="F8F9FA"/>');
        }
        xmlParts.push('<w:tcMar><w:top w:w="120" w:type="dxa"/><w:bottom w:w="120" w:type="dxa"/><w:left w:w="160" w:type="dxa"/><w:right w:w="160" w:type="dxa"/></w:tcMar>');
        xmlParts.push('</w:tcPr>');
        xmlParts.push('<w:p><w:pPr><w:spacing w:after="40" w:line="240" w:lineRule="auto"/></w:pPr>');
        xmlParts.push('<w:r><w:rPr>');
        if (isHeader) {
          xmlParts.push('<w:b/><w:color w:val="FFFFFF"/><w:sz w:val="20"/>');
        } else {
          xmlParts.push('<w:color w:val="333333"/><w:sz w:val="19"/>');
        }
        xmlParts.push('</w:rPr>');
        xmlParts.push(`<w:t xml:space="preserve">${escapeXml(cell)}</w:t>`);
        xmlParts.push('</w:r></w:p>');
        xmlParts.push('</w:tc>');
      }
      xmlParts.push('</w:tr>');
    }
    xmlParts.push('</w:tbl>');
    xmlParts.push('<w:p><w:pPr><w:spacing w:after="120"/></w:pPr></w:p>');
    tableRows = [];
    inTable = false;
  }

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i];
    const trimmed = rawLine.trim();

    // Table detection
    if (trimmed.startsWith('|') && trimmed.endsWith('|')) {
      // Check if separator line (|---|---|)
      if (/^\|(\s*[-:]+\s*\|)+$/.test(trimmed)) {
        continue;
      }
      const cells = trimmed
        .slice(1, -1)
        .split('|')
        .map(c => c.trim().replace(/\*\*/g, '').replace(/`/g, ''));
      tableRows.push(cells);
      inTable = true;
      continue;
    } else if (inTable) {
      flushTable();
    }

    if (trimmed === '' || trimmed === '---') {
      continue;
    }

    // Header 1
    if (trimmed.startsWith('# ')) {
      const text = trimmed.substring(2).trim();
      xmlParts.push('<w:p><w:pPr><w:pStyle w:val="Heading1"/><w:spacing w:before="280" w:after="120"/></w:pPr>');
      xmlParts.push(`<w:r><w:rPr><w:b/><w:color w:val="061A4F"/><w:sz w:val="32"/></w:rPr><w:t xml:space="preserve">${escapeXml(text)}</w:t></w:r></w:p>`);
      continue;
    }

    // Header 2
    if (trimmed.startsWith('## ')) {
      const text = trimmed.substring(3).trim();
      xmlParts.push('<w:p><w:pPr><w:pStyle w:val="Heading2"/><w:spacing w:before="220" w:after="100"/></w:pPr>');
      xmlParts.push(`<w:r><w:rPr><w:b/><w:color w:val="FD5E02"/><w:sz w:val="26"/></w:rPr><w:t xml:space="preserve">${escapeXml(text)}</w:t></w:r></w:p>`);
      continue;
    }

    // Header 3
    if (trimmed.startsWith('### ')) {
      const text = trimmed.substring(4).trim();
      xmlParts.push('<w:p><w:pPr><w:pStyle w:val="Heading3"/><w:spacing w:before="180" w:after="80"/></w:pPr>');
      xmlParts.push(`<w:r><w:rPr><w:b/><w:color w:val="061A4F"/><w:sz w:val="22"/></w:rPr><w:t xml:space="preserve">${escapeXml(text)}</w:t></w:r></w:p>`);
      continue;
    }

    // Header 4
    if (trimmed.startsWith('#### ')) {
      const text = trimmed.substring(5).trim();
      xmlParts.push('<w:p><w:pPr><w:pStyle w:val="Heading4"/><w:spacing w:before="140" w:after="60"/></w:pPr>');
      xmlParts.push(`<w:r><w:rPr><w:b/><w:color w:val="333333"/><w:sz w:val="20"/></w:rPr><w:t xml:space="preserve">${escapeXml(text)}</w:t></w:r></w:p>`);
      continue;
    }

    // Bullet item (* or -)
    if (/^[\*\-]\s+/.test(trimmed)) {
      const text = trimmed.replace(/^[\*\-]\s+/, '').trim();
      xmlParts.push('<w:p><w:pPr><w:pStyle w:val="ListBullet"/><w:spacing w:after="60" w:line="240" w:lineRule="auto"/></w:pPr>');
      // Format bold parts
      formatInlineRuns(xmlParts, text);
      xmlParts.push('</w:p>');
      continue;
    }

    // Numbered item (1. 2. etc)
    if (/^\d+\.\s+/.test(trimmed)) {
      const text = trimmed.replace(/^\d+\.\s+/, '').trim();
      const numMatch = trimmed.match(/^(\d+)\./)[1];
      xmlParts.push('<w:p><w:pPr><w:spacing w:after="60" w:line="240" w:lineRule="auto"/></w:pPr>');
      xmlParts.push(`<w:r><w:rPr><w:b/><w:color w:val="FD5E02"/><w:sz w:val="22"/></w:rPr><w:t xml:space="preserve">${escapeXml(numMatch)}. </w:t></w:r>`);
      formatInlineRuns(xmlParts, text);
      xmlParts.push('</w:p>');
      continue;
    }

    // Code block
    if (trimmed.startsWith('```')) {
      const codeLines = [];
      i++;
      while (i < lines.length && !lines[i].trim().startsWith('```')) {
        codeLines.push(lines[i]);
        i++;
      }
      xmlParts.push('<w:p><w:pPr><w:shd w:val="clear" w:color="auto" w:fill="F1F5F9"/><w:spacing w:before="100" w:after="100"/></w:pPr>');
      xmlParts.push(`<w:r><w:rPr><w:rFonts w:ascii="Consolas" w:hAnsi="Consolas"/><w:color w:val="0F172A"/><w:sz w:val="18"/></w:rPr><w:t xml:space="preserve">${escapeXml(codeLines.join('\n'))}</w:t></w:r></w:p>`);
      continue;
    }

    // Standard paragraph
    xmlParts.push('<w:p><w:pPr><w:spacing w:after="120" w:line="260" w:lineRule="auto"/></w:pPr>');
    formatInlineRuns(xmlParts, trimmed);
    xmlParts.push('</w:p>');
  }

  if (inTable) flushTable();
  return xmlParts.join('\n');
}

function formatInlineRuns(xmlParts, text) {
  // Regex to match **bold** and `code`
  const regex = /(\*\*[^*]+\*\*|`[^`]+`)/g;
  let lastIndex = 0;
  let match;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      const normalText = text.substring(lastIndex, match.index);
      xmlParts.push(`<w:r><w:rPr><w:color w:val="333333"/><w:sz w:val="22"/></w:rPr><w:t xml:space="preserve">${escapeXml(normalText)}</w:t></w:r>`);
    }

    const token = match[0];
    if (token.startsWith('**') && token.endsWith('**')) {
      const boldText = token.slice(2, -2);
      xmlParts.push(`<w:r><w:rPr><w:b/><w:color w:val="061A4F"/><w:sz w:val="22"/></w:rPr><w:t xml:space="preserve">${escapeXml(boldText)}</w:t></w:r>`);
    } else if (token.startsWith('`') && token.endsWith('`')) {
      const codeText = token.slice(1, -1);
      xmlParts.push(`<w:r><w:rPr><w:rFonts w:ascii="Consolas" w:hAnsi="Consolas"/><w:color w:val="C7254E"/><w:shd w:val="clear" w:color="auto" w:fill="F9F2F4"/><w:sz w:val="20"/></w:rPr><w:t xml:space="preserve">${escapeXml(codeText)}</w:t></w:r>`);
    }

    lastIndex = regex.lastIndex;
  }

  if (lastIndex < text.length) {
    const remaining = text.substring(lastIndex);
    xmlParts.push(`<w:r><w:rPr><w:color w:val="333333"/><w:sz w:val="22"/></w:rPr><w:t xml:space="preserve">${escapeXml(remaining)}</w:t></w:r>`);
  }
}

console.log('OpenXML helper module loaded successfully.');
