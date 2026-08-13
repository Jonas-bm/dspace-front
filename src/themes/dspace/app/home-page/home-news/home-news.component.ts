import {
  CommonModule,
  isPlatformBrowser,
} from '@angular/common';
import {
  ChangeDetectorRef,
  Component,
  Inject,
  NgZone,
  OnDestroy,
  OnInit,
  PLATFORM_ID,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  Router,
  RouterLink,
} from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';

import { HomeNewsComponent as BaseComponent } from '../../../../../app/home-page/home-news/home-news.component';

@Component({
  selector: 'ds-themed-home-news',
  styleUrls: ['./home-news.component.scss'],
  templateUrl: './home-news.component.html',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterLink,
    TranslateModule,
  ],
})
/**
 * Component to render the hero and quick access categories on the home page
 */
export class HomeNewsComponent extends BaseComponent implements OnInit, OnDestroy {
  searchQuery = '';
  currentSlide = 0;
  private slideInterval: any;

  slides = [
    {
      image: 'assets/images/hero-bg-1.png',
      alt: 'Repositorio Digital - Biblioteca Tecnológica 1',
    },
    {
      image: 'assets/images/hero-bg-2.png',
      alt: 'Repositorio Digital - Centro de Investigación 2',
    },
    {
      image: 'assets/images/hero-bg-3.png',
      alt: 'Repositorio Digital - Campus del Conocimiento 3',
    },
  ];

  categories = [
    {
      name: 'Artículos Científicos',
      icon: 'fas fa-microscope',
      filter: 'Artículo',
      query: 'f.itemtype=Artículo,equals',
    },
    {
      name: 'Conferencias',
      icon: 'fas fa-users',
      filter: 'Conferencia',
      query: 'f.itemtype=Conferencia,equals',
    },
    {
      name: 'Informes',
      icon: 'fas fa-file-alt',
      filter: 'Informe',
      query: 'f.itemtype=Informe,equals',
    },
    {
      name: 'Libros',
      icon: 'fas fa-book-open',
      filter: 'Libro',
      query: 'f.itemtype=Libro,equals',
    },
    {
      name: 'Productos Institucionales',
      icon: 'fas fa-landmark',
      filter: 'Institucional',
      query: 'f.itemtype=Institucional,equals',
    },
    {
      name: 'Tesis',
      icon: 'fas fa-graduation-cap',
      filter: 'Tesis',
      query: 'f.itemtype=Tesis,equals',
    },
  ];

  constructor(
    private router: Router,
    private cdr: ChangeDetectorRef,
    private ngZone: NgZone,
    @Inject(PLATFORM_ID) private platformId: any,
  ) {
    super();
  }

  ngOnInit(): void {
    if (isPlatformBrowser(this.platformId)) {
      // Run inside Angular's zone so change detection fires on every tick
      this.ngZone.run(() => {
        this.slideInterval = setInterval(() => {
          this.currentSlide = (this.currentSlide + 1) % this.slides.length;
          this.cdr.markForCheck();
        }, 6000);
      });
    }
  }

  ngOnDestroy(): void {
    if (this.slideInterval) {
      clearInterval(this.slideInterval);
    }
  }

  onSearchSubmit(): void {
    const trimmed = this.searchQuery?.trim();
    if (trimmed) {
      void this.router.navigate(['/search'], {
        queryParams: { query: trimmed },
      });
    } else {
      void this.router.navigate(['/search']);
    }
  }
}
