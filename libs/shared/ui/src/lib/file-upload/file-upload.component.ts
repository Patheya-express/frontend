import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  EventEmitter,
  Input,
  Output,
  ViewChild,
} from '@angular/core';

/**
 * Generalizes the customer-profile AvatarUploadComponent pattern for any file type — restaurant
 * logo/banner/gallery images, GST/FSSAI/PAN certificates (PDF), etc. Purely presentational: it
 * only emits the selected File, the parent page/facade owns the actual upload call, matching
 * every other upload flow in the repo (facade -> store -> service -> generated SDK).
 */
@Component({
  selector: 'lib-file-upload',
  standalone: true,
  templateUrl: './file-upload.component.html',
  styleUrl: './file-upload.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FileUploadComponent {
  /** e.g. "image/png,image/jpeg,image/webp" or "image/png,image/jpeg,application/pdf" */
  @Input() accept = 'image/png,image/jpeg,image/webp';
  @Input() label = 'Upload file';
  @Input() ariaLabel = 'Upload file';
  @Input() uploading = false;
  @Input() selectedFileName?: string;
  @Input() previewUrl?: string;
  @Input() hint?: string;
  /** When true, projects `[filePreview]` content instead of the built-in preview box — for
   *  callers needing a fundamentally different preview shape (e.g. a circular avatar). */
  @Input() customPreview = false;
  /** 'center' matches a standalone widget like an avatar picker; 'start' (default) matches this
   *  component's original left-aligned, form-field layout. */
  @Input() align: 'start' | 'center' = 'start';

  @Output() fileSelected = new EventEmitter<File>();

  @ViewChild('fileInput') private fileInput!: ElementRef<HTMLInputElement>;

  protected isImagePreview(): boolean {
    return !!this.previewUrl;
  }

  protected openFilePicker(): void {
    this.fileInput.nativeElement.click();
  }

  protected onFileChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];

    if (file) {
      this.fileSelected.emit(file);
    }

    input.value = '';
  }
}
