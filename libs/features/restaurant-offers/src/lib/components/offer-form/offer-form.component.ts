import { ChangeDetectionStrategy, Component, EventEmitter, Input, OnInit, Output, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import type { OfferResponseDto } from '@patheya-express-frontend/api-sdk';
import { PrimaryButtonComponent, SecondaryButtonComponent } from '@patheya-express-frontend/ui';
import { RestaurantOffersFacade } from '../../facades/restaurant-offers.facade';
import type { OfferFormValue } from '../../services/restaurant-offers.service';

type OfferType = OfferResponseDto['type'];

const OFFER_TYPES: { value: OfferType; label: string }[] = [
  { value: undefined, label: 'None' },
  { value: 'PERCENTAGE_OFF', label: 'Percentage Off' },
  { value: 'FLAT_OFF', label: 'Flat Off' },
  { value: 'FREE_DELIVERY', label: 'Free Delivery' },
  { value: 'BUY_ONE_GET_ONE', label: 'Buy One Get One' },
  { value: 'CASHBACK', label: 'Cashback' },
  { value: 'OTHER', label: 'Other' },
];

/** Backend dates are full ISO datetimes; `<input type="date">` needs just the date portion. */
function toDateInputValue(iso?: string): string {
  return iso ? iso.slice(0, 10) : '';
}

@Component({
  selector: 'lib-offer-form',
  standalone: true,
  imports: [ReactiveFormsModule, PrimaryButtonComponent, SecondaryButtonComponent],
  templateUrl: './offer-form.component.html',
  styleUrl: './offer-form.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OfferFormComponent implements OnInit {
  /** Omit to create a new offer; provide to edit an existing one. */
  @Input() offer?: OfferResponseDto;
  @Output() closed = new EventEmitter<void>();

  protected readonly facade = inject(RestaurantOffersFacade);
  private readonly formBuilder = inject(FormBuilder);

  protected readonly offerTypes = OFFER_TYPES;

  protected readonly form = this.formBuilder.group({
    title: ['', Validators.required],
    description: [''],
    imageUrl: [''],
    linkUrl: [''],
    type: [''],
    startsAt: [''],
    endsAt: [''],
  });

  ngOnInit(): void {
    if (this.offer) {
      this.form.patchValue({
        title: this.offer.title,
        description: this.offer.description ?? '',
        imageUrl: this.offer.imageUrl ?? '',
        linkUrl: this.offer.linkUrl ?? '',
        type: this.offer.type ?? '',
        startsAt: toDateInputValue(this.offer.startsAt),
        endsAt: toDateInputValue(this.offer.endsAt),
      });
    }
  }

  protected get isProcessing(): boolean {
    return this.facade.processingId() === (this.offer?.id ?? 'new-offer');
  }

  protected async submit(): Promise<void> {
    if (this.form.invalid || this.isProcessing) {
      return;
    }

    const { title, description, imageUrl, linkUrl, type, startsAt, endsAt } = this.form.getRawValue();

    const value: OfferFormValue = {
      title: title ?? '',
      description: description || undefined,
      imageUrl: imageUrl || undefined,
      linkUrl: linkUrl || undefined,
      type: (type || undefined) as OfferType,
      startsAt: startsAt ? new Date(startsAt).toISOString() : undefined,
      endsAt: endsAt ? new Date(endsAt).toISOString() : undefined,
    };

    const success = this.offer
      ? await this.facade.updateOffer(this.offer.id, value)
      : await this.facade.createOffer(value);

    if (success) {
      this.closed.emit();
    }
  }

  protected cancel(): void {
    this.facade.dismissValidationErrors();
    this.closed.emit();
  }
}
