import { ChangeDetectionStrategy, Component, ElementRef, EventEmitter, Input, Output, ViewChild, inject } from '@angular/core';
import { MediaUrlService } from '@patheya-express-frontend/core';

@Component({
  selector: 'lib-avatar-upload',
  standalone: true,
  templateUrl: './avatar-upload.component.html',
  styleUrl: './avatar-upload.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AvatarUploadComponent {
  private readonly mediaUrlService = inject(MediaUrlService);

  @Input() avatarUrl?: string;
  @Input() firstName = '';
  @Input() uploading = false;

  @Output() fileSelected = new EventEmitter<File>();

  @ViewChild('fileInput') private fileInput!: ElementRef<HTMLInputElement>;

  protected resolvedAvatarUrl(): string | undefined {
    return this.mediaUrlService.resolve(this.avatarUrl);
  }

  protected initials(): string {
    return this.firstName.charAt(0).toUpperCase() || '?';
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
