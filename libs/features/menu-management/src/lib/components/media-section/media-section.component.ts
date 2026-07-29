import { ChangeDetectionStrategy, Component, Input, inject, signal } from '@angular/core';
import type { MenuItemResponseDto } from '@patheya-express-frontend/api-sdk';
import {
  ConfirmDialogComponent,
  ErrorStateComponent,
  FileUploadComponent,
  SecondaryButtonComponent,
} from '@patheya-express-frontend/ui';
import { MenuManagementFacade } from '../../facades/menu-management.facade';

const ACCEPTED_IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/webp'];

@Component({
  selector: 'lib-media-section',
  standalone: true,
  imports: [FileUploadComponent, SecondaryButtonComponent, ConfirmDialogComponent, ErrorStateComponent],
  templateUrl: './media-section.component.html',
  styleUrl: './media-section.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MediaSectionComponent {
  @Input({ required: true }) item!: MenuItemResponseDto;

  protected readonly facade = inject(MenuManagementFacade);

  protected readonly localError = signal<string | null>(null);
  protected removeDialogOpen = false;

  protected get isBusy(): boolean {
    return this.facade.uploading();
  }

  protected onFileSelected(file: File): void {
    this.localError.set(null);
    this.facade.dismissUploadError();

    // The native <input accept="..."> attribute only filters the OS file picker — it doesn't
    // stop a drag-drop or a renamed file, so the actual MIME type is checked here too.
    if (!ACCEPTED_IMAGE_TYPES.includes(file.type)) {
      this.localError.set('Please choose a PNG, JPEG, or WEBP image.');
      return;
    }

    void this.facade.uploadImage(this.item.id, file);
  }

  protected retry(): void {
    void this.facade.retryUpload();
  }

  protected requestRemove(): void {
    this.removeDialogOpen = true;
  }

  protected cancelRemove(): void {
    this.removeDialogOpen = false;
  }

  protected confirmRemove(): void {
    this.removeDialogOpen = false;
    void this.facade.removeImage(this.item.id);
  }
}
