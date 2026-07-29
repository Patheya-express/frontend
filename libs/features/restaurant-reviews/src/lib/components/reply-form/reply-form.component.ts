import { ChangeDetectionStrategy, Component, EventEmitter, Input, OnInit, Output, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { PrimaryButtonComponent, SecondaryButtonComponent } from '@patheya-express-frontend/ui';
import { RestaurantReviewsFacade } from '../../facades/restaurant-reviews.facade';

const MAX_REPLY_LENGTH = 1000;

@Component({
  selector: 'lib-reply-form',
  standalone: true,
  imports: [ReactiveFormsModule, PrimaryButtonComponent, SecondaryButtonComponent],
  templateUrl: './reply-form.component.html',
  styleUrl: './reply-form.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ReplyFormComponent implements OnInit {
  @Input({ required: true }) reviewId!: string;
  /** Omit to create a new reply; provide the existing reply text to edit it. */
  @Input() existingReplyText?: string;
  @Output() closed = new EventEmitter<void>();

  protected readonly facade = inject(RestaurantReviewsFacade);
  private readonly formBuilder = inject(FormBuilder);

  protected readonly maxLength = MAX_REPLY_LENGTH;

  protected readonly form = this.formBuilder.group({
    replyText: ['', [Validators.required, Validators.maxLength(MAX_REPLY_LENGTH)]],
  });

  ngOnInit(): void {
    if (this.existingReplyText) {
      this.form.patchValue({ replyText: this.existingReplyText });
    }
  }

  protected get isEditing(): boolean {
    return this.existingReplyText !== undefined;
  }

  protected get isProcessing(): boolean {
    return this.facade.processingId() === this.reviewId;
  }

  protected async submit(): Promise<void> {
    if (this.form.invalid || this.isProcessing) {
      return;
    }

    const replyText = this.form.getRawValue().replyText ?? '';

    const success = this.isEditing
      ? await this.facade.updateReply(this.reviewId, replyText)
      : await this.facade.createReply(this.reviewId, replyText);

    if (success) {
      this.closed.emit();
    }
  }

  protected cancel(): void {
    this.facade.dismissValidationErrors();
    this.closed.emit();
  }
}
