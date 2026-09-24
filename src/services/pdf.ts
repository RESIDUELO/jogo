// Extração de texto de PDF no navegador (pdf.js carregado sob demanda).
export async function pdfToText(file: File, onProgress?: (p: number) => void): Promise<string> {
  const pdfjs = await import('pdfjs-dist');
  const worker = await import('pdfjs-dist/build/pdf.worker.min.mjs?url');
  pdfjs.GlobalWorkerOptions.workerSrc = worker.default;
  const doc = await pdfjs.getDocument({ data: await file.arrayBuffer() }).promise;
  const pages: string[] = [];
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    // agrupa itens por linha (coordenada y)
    const rows = new Map<number, { x: number; s: string }[]>();
    for (const it of content.items as { str: string; transform: number[] }[]) {
      if (!('str' in it)) continue;
      const y = Math.round(it.transform[5] / 3) * 3;
      if (!rows.has(y)) rows.set(y, []);
      rows.get(y)!.push({ x: it.transform[4], s: it.str });
    }
    const lines = [...rows.entries()]
      .sort((a, b) => b[0] - a[0])
      .map(([, items]) => items.sort((a, b) => a.x - b.x).map((i) => i.s).join('').trim())
      .filter(Boolean);
    pages.push(lines.join('\n'));
    onProgress?.(i / doc.numPages);
  }
  return pages.join('\n');
}
