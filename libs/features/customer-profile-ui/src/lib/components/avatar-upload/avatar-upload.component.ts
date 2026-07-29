import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output, inject } from '@angular/core';
import { FileUploadComponent } from '@patheya-express-frontend/ui';
import { MediaUrlService } from '@patheya-express-frontend/core';

@Component({
  selector: 'lib-avatar-upload',
  standalone: true,
  imports: [FileUploadComponent],
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

  protected resolvedAvatarUrl(): string | undefined {
    return this.mediaUrlService.resolve(this.avatarUrl);
  }

  protected initials(): string {
    return this.firstName.charAt(0).toUpperCase() || '?';
  }
}
