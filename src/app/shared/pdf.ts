import { Injectable } from '@angular/core';
import type { Content, TDocumentDefinitions } from 'pdfmake/interfaces';
@Injectable({ providedIn: 'root' })
export class PdfService {
  private loading: Promise<typeof import('pdfmake/build/pdfmake')> | undefined;
  private load() {
    return (this.loading ??= (async () => {
      const { default: pdf } = await import('pdfmake/build/pdfmake');
      const data: Record<string, string> = {};
      for (const weight of ['regular', 'bold']) {
        const response = await fetch('/fonts/noto-thai-' + weight + '.ttf');
        if (!response.ok) throw Error('โหลดฟอนต์ PDF ไม่สำเร็จ');
        const bytes = new Uint8Array(await response.arrayBuffer());
        data[weight + '.ttf'] = btoa(Array.from(bytes, (b) => String.fromCharCode(b)).join(''));
      }
      pdf.addVirtualFileSystem(data);
      pdf.addFonts({
        NotoThai: {
          normal: 'regular.ttf',
          bold: 'bold.ttf',
          italics: 'regular.ttf',
          bolditalics: 'bold.ttf',
        },
      });
      return pdf;
    })());
  }
  async make(title: string, content: Content[]): Promise<Blob> {
    const pdf = await this.load();
    const doc: TDocumentDefinitions = {
      defaultStyle: { font: 'NotoThai', fontSize: 10 },
      pageMargins: [36, 42, 36, 42],
      content: [
        { text: 'THAIKANA', fontSize: 23, bold: true, color: '#003B85' },
        {
          text: 'โหมดตัวอย่าง / DEMO DOCUMENT',
          fontSize: 9,
          color: '#a86413',
          margin: [0, 0, 0, 18],
        },
        { text: title, fontSize: 17, bold: true, margin: [0, 0, 0, 14] },
        ...content,
      ],
      footer: (page, pages) => ({
        text: page + ' / ' + pages,
        alignment: 'right',
        margin: [36, 0, 36, 0],
        fontSize: 8,
      }),
    };
    return pdf.createPdf(doc).getBlob();
  }
  open(blob: Blob) {
    const url = URL.createObjectURL(blob);
    window.open(url, '_blank', 'noopener');
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  }
  download(blob: Blob, name: string) {
    const url = URL.createObjectURL(blob),
      a = document.createElement('a');
    a.href = url;
    a.download = name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
}
