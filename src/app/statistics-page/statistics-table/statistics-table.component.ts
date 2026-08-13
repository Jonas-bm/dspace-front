import {
  AsyncPipe,
  CommonModule,
} from '@angular/common';
import {
  Component,
  Input,
  OnInit,
} from '@angular/core';
import { TranslateModule } from '@ngx-translate/core';

import { DSONameService } from '../../core/breadcrumbs/dso-name.service';
import { DSpaceObjectDataService } from '../../core/data/dspace-object-data.service';
import {
  Point,
  UsageReport,
} from '../../core/statistics/models/usage-report.model';

/**
 * Component representing a statistics table for a given usage report.
 */
@Component({
  selector: 'ds-statistics-table',
  templateUrl: './statistics-table.component.html',
  styleUrls: ['./statistics-table.component.scss'],
  standalone: true,
  imports: [
    AsyncPipe,
    CommonModule,
    TranslateModule,
  ],
})
export class StatisticsTableComponent implements OnInit {

  /**
   * The usage report to display a statistics table for
   */
  @Input()
  report: UsageReport;

  /**
   * Boolean indicating whether the usage report has data
   */
  hasData: boolean;

  /**
   * The table headers
   */
  headers: string[];

  /**
   * Controls toggle between graphical chart and traditional table view
   */
  isChartView = true;

  /**
   * Maximum value in the data points, used for scaling charts
   */
  maxValue = 0;

  // SVG dimensions and padding for time-series charts
  svgWidth = 600;
  svgHeight = 220;
  paddingX = 55;
  paddingY = 30;

  // SVG path definitions
  linePath = '';
  areaPath = '';

  // Points computed for SVG line chart
  svgPoints: { x: number, y: number, label: string, value: number }[] = [];

  // Y-axis helper lines
  yAxisGridLines: { y: number, value: number }[] = [];

  constructor(
    protected dsoService: DSpaceObjectDataService,
    protected nameService: DSONameService,
  ) {}

  ngOnInit() {
    this.hasData = this.report && this.report.points && this.report.points.length > 0;
    if (this.hasData) {
      this.headers = Object.keys(this.report.points[0].values);
      const values = this.report.points.map(p => this.getPointValue(p));
      this.maxValue = Math.max(...values, 0);

      if (this.report.reportType === 'TotalVisitsPerMonth') {
        this.calculateSVGCoordinates();
      }
    }
  }

  /**
   * Extracts the numeric value of the first metric header for a given data point
   */
  getPointValue(point: Point): number {
    if (!point || !point.values || !this.headers || this.headers.length === 0) {
      return 0;
    }
    const val = point.values[this.headers[0]];
    return typeof val === 'number' ? val : 0;
  }

  /**
   * Calculates the width percentage of a ranking progress bar
   */
  getBarWidthPercentage(point: Point): number {
    if (this.maxValue === 0) {
      return 0;
    }
    const val = this.getPointValue(point);
    const pct = (val / this.maxValue) * 100;
    return pct > 0 ? Math.max(pct, 2) : 0; // Return min 2% if value > 0 so bar is visible
  }

  /**
   * Calculates dynamic SVG coordinates for rendering a trend line and filled area chart
   */
  calculateSVGCoordinates() {
    const pointsCount = this.report.points.length;
    if (pointsCount === 0) {
      return;
    }

    const values = this.report.points.map(p => this.getPointValue(p));
    const maxVal = Math.max(...values, 1); // Avoid division by zero

    // Compute coordinate points
    this.svgPoints = this.report.points.map((p, i) => {
      const val = this.getPointValue(p);
      const x = pointsCount > 1
        ? this.paddingX + (i / (pointsCount - 1)) * (this.svgWidth - 2 * this.paddingX)
        : this.svgWidth / 2;
      const usableHeight = this.svgHeight - 2 * this.paddingY;
      const y = (this.svgHeight - this.paddingY) - (val / maxVal) * usableHeight;
      return { x, y, label: p.label, value: val };
    });

    // Create SVG paths
    if (this.svgPoints.length > 0) {
      this.linePath = this.svgPoints.map((pt, idx) => {
        return `${idx === 0 ? 'M' : 'L'} ${pt.x} ${pt.y}`;
      }).join(' ');

      const bottomY = this.svgHeight - this.paddingY;
      const firstPt = this.svgPoints[0];
      const lastPt = this.svgPoints[this.svgPoints.length - 1];
      this.areaPath = `${this.linePath} L ${lastPt.x} ${bottomY} L ${firstPt.x} ${bottomY} Z`;
    }

    // Create Grid lines (Top, Middle, Bottom)
    const usableHeight = this.svgHeight - 2 * this.paddingY;
    this.yAxisGridLines = [
      { y: this.paddingY, value: maxVal },
      { y: this.paddingY + usableHeight / 2, value: Math.round(maxVal / 2) },
      { y: this.svgHeight - this.paddingY, value: 0 },
    ];
  }

  /**
   * Toggles active view between Chart and Table representation
   */
  toggleView() {
    this.isChartView = !this.isChartView;
  }
}
