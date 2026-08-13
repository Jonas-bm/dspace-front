import {
  CommonModule,
  isPlatformBrowser,
} from '@angular/common';
import {
  ChangeDetectorRef,
  Component,
  Inject,
  Input,
  OnChanges,
  OnInit,
  PLATFORM_ID,
  SimpleChanges,
} from '@angular/core';

declare const pdfjsLib: any;

@Component({
  selector: 'ds-pdf-thumbnail',
  standalone: true,
  imports: [
    CommonModule,
  ],
  styles: [`
    :host {
      display: contents;
    }
  `],
  template: `
    <img
      [src]="thumbnailUrl || fallbackUrl"
      [alt]="alt"
      [class]="class"
      [id]="id"
      [style.opacity]="loading ? 0.6 : 1"
      style="transition: opacity 0.3s ease;"
    />
  `,
})
export class PdfThumbnailComponent implements OnInit, OnChanges {
  @Input() pdfUrl: string;
  @Input() fallbackUrl = 'assets/org/logo-unid.png';
  @Input() alt = 'PDF Preview';
  @Input() class = '';
  @Input() id = '';

  thumbnailUrl: string | null = null;
  loading = false;
  private isBrowser: boolean;

  constructor(
    @Inject(PLATFORM_ID) private platformId: any,
    private cdr: ChangeDetectorRef,
  ) {
    this.isBrowser = isPlatformBrowser(this.platformId);
  }

  ngOnInit(): void {
    if (this.isBrowser && this.pdfUrl) {
      this.loadAndRenderPdf();
    }
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (this.isBrowser && changes.pdfUrl && !changes.pdfUrl.firstChange) {
      this.loadAndRenderPdf();
    }
  }

  private getCacheKey(): string {
    return 'pdf_thumb_' + (this.pdfUrl || '');
  }

  private loadAndRenderPdf(): void {
    if (!this.pdfUrl) { return; }

    try {
      const cached = sessionStorage.getItem(this.getCacheKey());
      if (cached) {
        this.thumbnailUrl = cached;
        this.loading = false;
        this.cdr.detectChanges();
        return;
      }
    } catch (e) {
      // ignore
    }

    this.loading = true;
    this.thumbnailUrl = null;
    this.cdr.detectChanges();

    if (typeof (window as any).pdfjsLib === 'undefined') {
      const script = document.createElement('script');
      script.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.4.120/pdf.min.js';
      script.onload = () => {
        (window as any).pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.4.120/pdf.worker.min.js';
        this.renderFirstPage();
      };
      script.onerror = () => {
        console.error('Failed to load PDF.js library from CDN');
        this.loading = false;
        this.cdr.detectChanges();
      };
      document.head.appendChild(script);
    } else {
      this.renderFirstPage();
    }
  }

  private renderFirstPage(): void {
    const loadingTask = (window as any).pdfjsLib.getDocument(this.pdfUrl);
    loadingTask.promise.then((pdf: any) => {
      pdf.getPage(1).then((page: any) => {
        const scale = 1.5;
        const viewport = page.getViewport({ scale });

        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        if (!context) {
          throw new Error('Canvas 2D context not available');
        }

        canvas.height = viewport.height;
        canvas.width = viewport.width;

        const renderContext = {
          canvasContext: context,
          viewport: viewport,
        };

        const renderTask = page.render(renderContext);
        renderTask.promise.then(() => {
          const dataUrl = canvas.toDataURL('image/png');
          this.thumbnailUrl = dataUrl;
          this.loading = false;
          try {
            sessionStorage.setItem(this.getCacheKey(), dataUrl);
          } catch (e) {
            // ignore
          }
          this.cdr.detectChanges();
        });
      });
    }).catch((err: any) => {
      console.error('Error loading or rendering PDF:', err);
      this.loading = false;
      this.cdr.detectChanges();
    });
  }
}
