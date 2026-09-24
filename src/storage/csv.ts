// Parser de CSV/TXT para importação de flashcards.
// Aceita: CSV com aspas (vírgula ou ponto-e-vírgula), TSV (exportação do Anki em texto) e cabeçalho opcional.

export interface ParsedRow { front: string; back: string; deck: string; tags: string[] }

function detectDelimiter(text: string): string {
  const sample = text.split(/\r?\n/).slice(0, 5).join('\n');
  const counts = [',', ';', '\t'].map(d => ({ d, n: sample.split(d).length }));
  counts.sort((a, b) => b.n - a.n);
  return counts[0].d;
}

export function parseDelimited(text: string, delim: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; } else quoted = false;
      } else field += ch;
    } else if (ch === '"' && field === '') {
      quoted = true;
    } else if (ch === delim) {
      row.push(field); field = '';
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++;
      row.push(field); rows.push(row); row = []; field = '';
    } else field += ch;
  }
  if (field !== '' || row.length) { row.push(field); rows.push(row); }
  return rows.filter(r => r.some(f => f.trim() !== ''));
}

const HEADER = /^(front|frente|pergunta|question)$/i;

export function parseCards(text: string): ParsedRow[] {
  // linhas de comentário do Anki (#separator, #html etc.)
  const clean = text.replace(/^﻿/, '').split(/\r?\n/).filter(l => !l.startsWith('#')).join('\n');
  const rows = parseDelimited(clean, detectDelimiter(clean));
  if (rows.length && HEADER.test(rows[0][0]?.trim() ?? '')) rows.shift();
  return rows
    .filter(r => r.length >= 2 && r[0].trim() && r[1].trim())
    .map(r => ({
      front: stripHtml(r[0].trim()),
      back: stripHtml(r[1].trim()),
      deck: (r[2] ?? '').trim(),
      tags: (r[3] ?? '').split(/[\s;|,]+/).map(t => t.trim()).filter(Boolean),
    }));
}

function stripHtml(s: string): string {
  if (!/[<&]/.test(s)) return s;
  const doc = new DOMParser().parseFromString(s.replace(/<br\s*\/?>/gi, '\n').replace(/<\/(div|p)>/gi, '\n'), 'text/html');
  return (doc.body.textContent ?? '').trim();
}
