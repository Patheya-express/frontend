import { ChangeDetectionStrategy, Component, OnInit, inject } from '@angular/core';
import { MediaUrlService } from '@patheya-express-frontend/core';
import {
  ConfirmDialogComponent,
  EmptyStateComponent,
  ErrorStateComponent,
  FileUploadComponent,
  SkeletonComponent,
} from '@patheya-express-frontend/ui';
import { RestaurantGalleryFacade } from '../../facades/restaurant-gallery.facade';
import type { GalleryMediaType } from '../../services/restaurant-gallery.service';

const GALLERY_TYPES: GalleryMediaType[] = [
  'FRONT_VIEW', 'EXTERIOR', 'KITCHEN', 'DINING', 'INTERIOR', 'SIGN_BOARD', 'GALLERY', 'VIDEO',
];

@Component({
  selector: 'lib-gallery-page',
  standalone: true,
  imports: [FileUploadComponent, SkeletonComponent, ErrorStateComponent, EmptyStateComponent, ConfirmDialogComponent],
  templateUrl: './gallery-page.component.html',
  styleUrl: './gallery-page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class GalleryPageComponent implements OnInit {
  protected readonly facade = inject(RestaurantGalleryFacade);
  private readonly mediaUrl = inject(MediaUrlService);

  protected readonly galleryTypes = GALLERY_TYPES;
  protected selectedType: GalleryMediaType = 'GALLERY';
  protected confirmRemoveId: string | null = null;

  ngOnInit(): void {
    this.facade.initialize();
  }

  protected resolveUrl(path: string | undefined): string | undefined {
    return this.mediaUrl.resolve(path);
  }

  protected onLogoSelected(file: File): void {
    void this.facade.uploadLogo(file);
  }

  protected onBannerSelected(file: File): void {
    void this.facade.uploadBanner(file);
  }

  protected onTypeChange(event: Event): void {
    this.selectedType = (event.target as HTMLSelectElement).value as GalleryMediaType;
  }

  protected onGalleryFileSelected(file: File): void {
    void this.facade.uploadMedia(this.selectedType, file);
  }

  protected moveUp(index: number): void {
    if (index === 0) return;
    const ids = this.facade.media().map((item) => item.id);
    [ids[index - 1], ids[index]] = [ids[index], ids[index - 1]];
    void this.facade.reorder(ids);
  }

  protected moveDown(index: number): void {
    const items = this.facade.media();
    if (index === items.length - 1) return;
    const ids = items.map((item) => item.id);
    [ids[index], ids[index + 1]] = [ids[index + 1], ids[index]];
    void this.facade.reorder(ids);
  }

  protected requestRemove(mediaId: string): void {
    this.confirmRemoveId = mediaId;
  }

  protected cancelRemove(): void {
    this.confirmRemoveId = null;
  }

  protected confirmRemove(): void {
    if (!this.confirmRemoveId) return;

    void this.facade.removeMedia(this.confirmRemoveId).then(() => {
      this.confirmRemoveId = null;
    });
  }

  protected retry(): void {
    this.facade.refresh();
  }
}
