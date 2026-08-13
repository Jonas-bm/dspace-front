import {
  AsyncPipe,
  CommonModule,
  NgClass,
  NgTemplateOutlet,
} from '@angular/common';
import {
  Component,
  Inject,
  OnInit,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  ActivatedRoute,
  NavigationEnd,
  Router,
  RouterLink,
} from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import {
  forkJoin,
  Observable,
  of,
} from 'rxjs';
import {
  catchError,
  filter,
  map,
  switchMap,
  take,
} from 'rxjs/operators';
import {
  APP_CONFIG,
  AppConfig,
} from 'src/config/app-config.interface';

import {
  SortDirection,
  SortOptions,
} from '../../../../app/core/cache/models/sort-options.model';
import { BitstreamDataService } from '../../../../app/core/data/bitstream-data.service';
import { PaginatedList } from '../../../../app/core/data/paginated-list.model';
import { RemoteData } from '../../../../app/core/data/remote-data';
import { SiteDataService } from '../../../../app/core/data/site-data.service';
import { Bitstream } from '../../../../app/core/shared/bitstream.model';
import { DSpaceObjectType } from '../../../../app/core/shared/dspace-object-type.model';
import { Item } from '../../../../app/core/shared/item.model';
import {
  getFirstCompletedRemoteData,
  toDSpaceObjectListRD,
} from '../../../../app/core/shared/operators';
import { SearchService } from '../../../../app/core/shared/search/search.service';
import { Site } from '../../../../app/core/shared/site.model';
import {
  Point,
  UsageReport,
} from '../../../../app/core/statistics/models/usage-report.model';
import { UsageReportDataService } from '../../../../app/core/statistics/usage-report-data.service';
import { ThemedHomeNewsComponent } from '../../../../app/home-page/home-news/themed-home-news.component';
import { HomePageComponent as BaseComponent } from '../../../../app/home-page/home-page.component';
import { RecentItemListComponent } from '../../../../app/home-page/recent-item-list/recent-item-list.component';
import { ThemedTopLevelCommunityListComponent } from '../../../../app/home-page/top-level-community-list/themed-top-level-community-list.component';
import { SuggestionsPopupComponent } from '../../../../app/notifications/suggestions/popup/suggestions-popup.component';
import { PaginationComponentOptions } from '../../../../app/shared/pagination/pagination-component-options.model';
import { PdfThumbnailComponent } from '../../../../app/shared/pdf-thumbnail/pdf-thumbnail.component';
import { PaginatedSearchOptions } from '../../../../app/shared/search/models/paginated-search-options.model';
import { ThemedSearchFormComponent } from '../../../../app/shared/search-form/themed-search-form.component';
import { environment } from '../../../../environments/environment';


export interface RecentPublication {
  id: string;
  title: string;
  authors: string[];
  abstract: string;
  accessType: string;
  itemType: string;
  year: string;
  views: number;
  downloads: number;
  keywords: string[];
  handle?: string;
  pdfUrl?: string;
}

export interface TopItem {
  id: string;
  title: string;
  count: number;
  handle?: string;
}

export interface IndexLink {
  label: string;
  icon: string;
  route: string;
}

@Component({
  selector: 'ds-themed-home-page',
  styleUrls: ['./home-page.component.scss'],
  templateUrl: './home-page.component.html',
  standalone: true,
  imports: [
    AsyncPipe,
    CommonModule,
    FormsModule,
    NgClass,
    NgTemplateOutlet,
    PdfThumbnailComponent,
    RecentItemListComponent,
    RouterLink,
    SuggestionsPopupComponent,
    ThemedHomeNewsComponent,
    ThemedSearchFormComponent,
    ThemedTopLevelCommunityListComponent,
    TranslateModule,
  ],
})
export class HomePageComponent extends BaseComponent implements OnInit {
  exploreIndices: IndexLink[] = [
    { label: 'Por fecha de publicación', icon: 'fas fa-calendar-alt', route: '/browse/dateissued' },
    { label: 'Por autor', icon: 'fas fa-user', route: '/browse/author' },
    { label: 'Por título', icon: 'fas fa-font', route: '/browse/title' },
    { label: 'Por materia', icon: 'fas fa-tags', route: '/browse/subject' },
    { label: 'Por categoría', icon: 'fas fa-th-list', route: '/browse/srsc' },
  ];

  recentPublications: RecentPublication[] = [];

  topVisitedLoading = true;
  topVisitedError = false;
  topVisited: TopItem[] = [];

  topDownloadedLoading = true;
  topDownloadedError = false;
  topDownloaded: TopItem[] = [];

  partnerLogos = [
    {
      name: 'ALICIA',
      src: 'assets/org/alicia.webp',
      url: 'https://alicia.concytec.gob.pe/',
      alt: 'ALICIA - Acceso Libre a la Información Científica',
    },
    {
      name: 'RENATI',
      src: 'assets/org/renati.webp',
      url: 'https://renati.sunedu.gob.pe/',
      alt: 'RENATI - SUNEDU',
    },
    {
      name: 'LA Referencia',
      src: 'assets/org/referencia.webp',
      url: 'https://www.lareferencia.info/',
      alt: 'LA Referencia - Red de Repositorios de Acceso Abierto a la Ciencia',
    },
  ];

  currentPage = 1;
  selectedPageSize = 5;
  totalResults = 0;
  totalPages = 1;
  isLoading = false;

  get skeletonItems(): number[] {
    return Array.from({ length: this.selectedPageSize }, (_, i) => i);
  }

  constructor(
    @Inject(APP_CONFIG) protected override appConfig: AppConfig,
    protected override route: ActivatedRoute,
    protected router: Router,
    protected searchService: SearchService,
    protected bitstreamDataService: BitstreamDataService,
    protected siteDataService: SiteDataService,
    protected usageReportDataService: UsageReportDataService,
  ) {
    super(appConfig, route);
  }

  override ngOnInit(): void {
    super.ngOnInit();
    this.loadRecentPublications();
    this.loadTopVisited();
    this.loadTopDownloaded();

    // Auto-refresh fresh statistics whenever the user navigates back to Home page
    this.router.events.pipe(
      filter((event): event is NavigationEnd => event instanceof NavigationEnd),
    ).subscribe((event: NavigationEnd) => {
      const url = event.urlAfterRedirects;
      if (url === '/' || url === '/home' || url.startsWith('/home?') || url.startsWith('/?')) {
        this.loadTopVisited();
        this.loadTopDownloaded();
        this.loadRecentPublications();
      }
    });
  }

  loadTopVisited(): void {
    this.topVisitedLoading = true;
    this.topVisitedError = false;

    this.siteDataService.find().pipe(
      take(1),
      switchMap((site: Site) => {
        if (!site || !site._links || !site._links.self) {
          return of([]);
        }
        return this.usageReportDataService.searchStatistics(site._links.self.href, 0, 10, false).pipe(
          catchError(() => of([])),
        );
      }),
      catchError(() => of([])),
    ).subscribe((reports: UsageReport[]) => {
      let visited: TopItem[] = [];
      if (reports && reports.length > 0) {
        const totalVisitsReport = reports.find(r => r.reportType === 'TotalVisits');
        if (totalVisitsReport && totalVisitsReport.points && totalVisitsReport.points.length > 0) {
          visited = totalVisitsReport.points
            .map((point: Point) => {
              const count = this.extractViewsCount(point.values);
              return {
                id: point.id,
                title: point.label || 'Sin título',
                count: count,
              };
            })
            .filter((item) => item.count > 0)
            .sort((a, b) => b.count - a.count)
            .slice(0, 7);
        }
      }

      if (visited.length > 0) {
        this.topVisited = visited;
        this.topVisitedLoading = false;
      } else {
        this.loadFallbackTopVisited();
      }
    });
  }

  loadTopDownloaded(): void {
    this.topDownloadedLoading = true;
    this.topDownloadedError = false;

    const paginationConfig = Object.assign(new PaginationComponentOptions(), {
      id: 'hp_top_dl_candidates',
      pageSize: 15,
      currentPage: 1,
    });

    this.searchService.search(
      new PaginatedSearchOptions({
        pagination: paginationConfig,
        dsoTypes: [DSpaceObjectType.ITEM],
      }),
    ).pipe(
      toDSpaceObjectListRD(),
      getFirstCompletedRemoteData(),
      catchError(() => of(null)),
    ).subscribe((rd: RemoteData<PaginatedList<Item>>) => {
      if (rd && rd.hasSucceeded && rd.payload && rd.payload.page.length > 0) {
        const items = rd.payload.page;
        const requests: Observable<TopItem>[] = items.map((item): Observable<TopItem> => {
          const itemUri = item._links && item._links.self ? item._links.self.href : undefined;
          const obs$: Observable<UsageReport[]> = itemUri
            ? this.usageReportDataService.searchStatistics(itemUri, 0, 10, false)
            : this.usageReportDataService.getStatistic(item.id, 'TotalDownloads').pipe(
              map((report: UsageReport) => (report ? [report] : [])),
            );

          return obs$.pipe(
            map((reports: UsageReport[]): TopItem => {
              let totalDl = 0;
              const dlReport = reports.find(r => r.reportType === 'TotalDownloads');
              if (dlReport && dlReport.points && dlReport.points.length > 0) {
                dlReport.points.forEach((pt: Point) => {
                  totalDl += this.extractViewsCount(pt.values);
                });
              }

              return {
                id: item.id,
                title: item.firstMetadataValue('dc.title') || 'Sin título',
                count: totalDl,
              };
            }),
            catchError(() => of({
              id: item.id,
              title: item.firstMetadataValue('dc.title') || 'Sin título',
              count: 0,
            })),
          );
        });

        forkJoin(requests).subscribe((results: TopItem[]) => {
          const downloaded = results
            .filter((item) => item.count > 0)
            .sort((a, b) => b.count - a.count)
            .slice(0, 7);

          if (downloaded.length > 0) {
            this.topDownloaded = downloaded;
            this.topDownloadedLoading = false;
          } else {
            this.loadFallbackTopDownloaded(items);
          }
        });
      } else {
        this.topDownloadedLoading = false;
        this.topDownloaded = [];
      }
    });
  }

  private loadFallbackTopVisited(): void {
    const paginationConfig = Object.assign(new PaginationComponentOptions(), {
      id: 'hp_visited_fallback',
      pageSize: 7,
      currentPage: 1,
    });

    this.searchService.search(
      new PaginatedSearchOptions({
        pagination: paginationConfig,
        dsoTypes: [DSpaceObjectType.ITEM],
      }),
    ).pipe(
      toDSpaceObjectListRD(),
      getFirstCompletedRemoteData(),
      catchError(() => of(null)),
    ).subscribe((rd: RemoteData<PaginatedList<Item>>) => {
      if (rd && rd.hasSucceeded && rd.payload && rd.payload.page.length > 0) {
        const items = rd.payload.page;
        const requests: Observable<TopItem>[] = items.map((item): Observable<TopItem> => {
          const itemUri = item._links && item._links.self ? item._links.self.href : undefined;
          const obs$: Observable<UsageReport[]> = itemUri
            ? this.usageReportDataService.searchStatistics(itemUri, 0, 10, false)
            : of([]);

          return obs$.pipe(
            map((reports: UsageReport[]): TopItem => {
              let totalViews = 0;
              if (reports && reports.length > 0) {
                const visitsReport = reports.find(r => r.reportType === 'TotalVisits');
                if (visitsReport && visitsReport.points) {
                  visitsReport.points.forEach((pt: Point) => {
                    totalViews += this.extractViewsCount(pt.values);
                  });
                }
              }
              return {
                id: item.id,
                title: item.firstMetadataValue('dc.title') || 'Sin título',
                count: totalViews,
              };
            }),
            catchError(() => of({
              id: item.id,
              title: item.firstMetadataValue('dc.title') || 'Sin título',
              count: 0,
            })),
          );
        });

        forkJoin(requests).subscribe((results: TopItem[]) => {
          this.topVisitedLoading = false;
          this.topVisited = results.sort((a, b) => b.count - a.count).slice(0, 7);
        });
      } else {
        this.topVisitedLoading = false;
        this.topVisited = [];
      }
    });
  }

  private loadFallbackTopDownloaded(items: Item[]): void {
    if (!items || items.length === 0) {
      this.topDownloadedLoading = false;
      this.topDownloaded = [];
      return;
    }

    const requests: Observable<TopItem>[] = items.slice(0, 7).map((item): Observable<TopItem> => {
      const itemUri = item._links && item._links.self ? item._links.self.href : undefined;
      const obs$: Observable<UsageReport[]> = itemUri
        ? this.usageReportDataService.searchStatistics(itemUri, 0, 10, false)
        : of([]);

      return obs$.pipe(
        map((reports: UsageReport[]): TopItem => {
          let totalDl = 0;
          if (reports && reports.length > 0) {
            const dlReport = reports.find(r => r.reportType === 'TotalDownloads');
            if (dlReport && dlReport.points) {
              dlReport.points.forEach((pt: Point) => {
                totalDl += this.extractViewsCount(pt.values);
              });
            }
          }
          return {
            id: item.id,
            title: item.firstMetadataValue('dc.title') || 'Sin título',
            count: totalDl,
          };
        }),
        catchError(() => of({
          id: item.id,
          title: item.firstMetadataValue('dc.title') || 'Sin título',
          count: 0,
        })),
      );
    });

    forkJoin(requests).subscribe((results: TopItem[]) => {
      this.topDownloadedLoading = false;
      this.topDownloaded = results.sort((a, b) => b.count - a.count).slice(0, 7);
    });
  }

  private extractViewsCount(val: any): number {
    if (!val) {return 0;}
    if (typeof val === 'number') {return val;}
    if (typeof val.views === 'number') {return val.views;}
    if (Array.isArray(val) && val.length > 0) {
      if (typeof val[0] === 'number') {return val[0];}
      if (val[0] && typeof val[0].views === 'number') {return val[0].views;}
      const firstVal = Object.values(val[0])[0];
      if (typeof firstVal === 'number') {return firstVal;}
    }
    if (typeof val === 'object') {
      const firstVal = Object.values(val)[0];
      if (typeof firstVal === 'number') {return firstVal;}
    }
    return 0;
  }

  loadRecentPublications(): void {
    this.isLoading = true;
    const paginationConfig = Object.assign(new PaginationComponentOptions(), {
      id: 'hp_recent',
      pageSize: this.selectedPageSize,
      currentPage: this.currentPage,
      maxSize: 1,
    });

    const sortConfig = new SortOptions(
      environment.homePage.recentSubmissions.sortField || 'dc.date.accessioned',
      SortDirection.DESC,
    );

    this.searchService.search(
      new PaginatedSearchOptions({
        pagination: paginationConfig,
        dsoTypes: [DSpaceObjectType.ITEM],
        sort: sortConfig,
      }),
    ).pipe(
      toDSpaceObjectListRD(),
      getFirstCompletedRemoteData(),
    ).subscribe((rd: RemoteData<PaginatedList<Item>>) => {
      this.isLoading = false;
      if (rd.hasSucceeded && rd.payload) {
        this.totalResults = rd.payload.totalElements;
        this.totalPages = rd.payload.totalPages;

        if (rd.payload.page.length > 0) {
          const items = rd.payload.page;
          const publications: RecentPublication[] = [];

          items.forEach((item) => {
            const pub: RecentPublication = {
              id: item.uuid,
              title: item.firstMetadataValue('dc.title') || 'Sin título',
              authors: item.allMetadataValues('dc.contributor.author').length > 0
                ? item.allMetadataValues('dc.contributor.author')
                : (item.allMetadataValues('dc.creator').length > 0 ? item.allMetadataValues('dc.creator') : ['Autor desconocido']),
              abstract: item.firstMetadataValue('dc.description.abstract') || 'Sin resumen disponible.',
              accessType: 'Acceso abierto',
              itemType: item.firstMetadataValue('dc.type') || 'Artículo',
              year: this.getYearFromDate(item.firstMetadataValue('dc.date.issued') || item.firstMetadataValue('dc.date.accessioned')),
              views: 0,
              downloads: 0,
              keywords: item.allMetadataValues('dc.subject').slice(0, 4),
              handle: item.handle,
              pdfUrl: undefined,
            };

            publications.push(pub);

            // Fetch real Solr stats for this item
            if (item._links && item._links.self) {
              this.usageReportDataService.searchStatistics(item._links.self.href, 0, 10, false).pipe(
                catchError(() => of([])),
              ).subscribe((reports: UsageReport[]) => {
                if (reports && reports.length > 0) {
                  const visitsReport = reports.find(r => r.reportType === 'TotalVisits');
                  if (visitsReport && visitsReport.points) {
                    let totalV = 0;
                    visitsReport.points.forEach(pt => totalV += this.extractViewsCount(pt.values));
                    pub.views = totalV;
                  }

                  const dlReport = reports.find(r => r.reportType === 'TotalDownloads');
                  if (dlReport && dlReport.points) {
                    let totalD = 0;
                    dlReport.points.forEach(pt => totalD += this.extractViewsCount(pt.values));
                    pub.downloads = totalD;
                  }
                }
              });
            }

            // Resolve first PDF bitstream
            this.bitstreamDataService.findAllByItemAndBundleName(item, 'ORIGINAL', {
              currentPage: 1,
              elementsPerPage: 20,
            }, true, true).pipe(
              getFirstCompletedRemoteData(),
            ).subscribe((bitstreamsRD: RemoteData<PaginatedList<Bitstream>>) => {
              if (bitstreamsRD.hasSucceeded && bitstreamsRD.payload && bitstreamsRD.payload.page.length > 0) {
                const pdfBitstream = bitstreamsRD.payload.page.find(bitstream =>
                  bitstream.name && bitstream.name.toLowerCase().endsWith('.pdf'),
                );
                if (pdfBitstream && pdfBitstream._links && pdfBitstream._links.content) {
                  pub.pdfUrl = pdfBitstream._links.content.href;
                }
              }
            });
          });

          this.recentPublications = publications;
        } else {
          this.recentPublications = [];
        }
      } else {
        this.recentPublications = [];
        this.totalResults = 0;
        this.totalPages = 1;
      }
    });
  }

  onPageSizeChange(newSize: any): void {
    this.selectedPageSize = Number(newSize);
    this.currentPage = 1;
    this.loadRecentPublications();
  }

  goToPage(page: number): void {
    if (page >= 1 && page <= this.totalPages) {
      this.currentPage = page;
      this.loadRecentPublications();
    }
  }

  get resultsRangeText(): string {
    if (this.totalResults === 0) {
      return '0 resultados';
    }
    const start = (this.currentPage - 1) * this.selectedPageSize + 1;
    const end = Math.min(this.currentPage * this.selectedPageSize, this.totalResults);
    return `${start} - ${end} de ${this.totalResults} resultados`;
  }

  private getYearFromDate(dateString: string | null): string {
    if (!dateString) {
      return new Date().getFullYear().toString();
    }
    const match = dateString.match(/\d{4}/);
    return match ? match[0] : new Date().getFullYear().toString();
  }
}
