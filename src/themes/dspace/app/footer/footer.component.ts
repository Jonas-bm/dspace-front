import {
  AsyncPipe,
  CommonModule,
  DatePipe,
} from '@angular/common';
import {
  Component,
  Inject,
  OnInit,
  Optional,
} from '@angular/core';
import {
  NavigationEnd,
  Router,
  RouterLink,
} from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { filter } from 'rxjs/operators';
import {
  APP_CONFIG,
  AppConfig,
} from 'src/config/app-config.interface';

import { NotifyInfoService } from '../../../../app/core/coar-notify/notify-info/notify-info.service';
import { AuthorizationDataService } from '../../../../app/core/data/feature-authorization/authorization-data.service';
import { FooterComponent as BaseComponent } from '../../../../app/footer/footer.component';
import { OrejimeService } from '../../../../app/shared/cookies/orejime.service';

@Component({
  selector: 'ds-themed-footer',
  styleUrls: ['./footer.component.scss'],
  templateUrl: './footer.component.html',
  standalone: true,
  imports: [
    AsyncPipe,
    CommonModule,
    DatePipe,
    RouterLink,
    TranslateModule,
  ],
})
export class FooterComponent extends BaseComponent implements OnInit {
  /** True only when the current route is the home page */
  isHomePage = false;

  constructor(
    @Optional() public override cookies: OrejimeService,
    protected override authorizationService: AuthorizationDataService,
    protected override notifyInfoService: NotifyInfoService,
    @Inject(APP_CONFIG) protected override appConfig: AppConfig,
    private router: Router,
  ) {
    super(cookies, authorizationService, notifyInfoService, appConfig);
  }

  override ngOnInit(): void {
    super.ngOnInit();
    // Detect route changes and flag home page
    this.isHomePage = this.isHome(this.router.url);
    this.router.events.pipe(
      filter(e => e instanceof NavigationEnd),
    ).subscribe((e: NavigationEnd) => {
      this.isHomePage = this.isHome(e.urlAfterRedirects);
    });
  }

  private isHome(url: string): boolean {
    return url === '/' || url === '/home' || url.startsWith('/home?') || url.startsWith('/?');
  }
}
