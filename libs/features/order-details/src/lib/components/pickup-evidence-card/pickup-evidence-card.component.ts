import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { MediaUrlService } from '@patheya-express-frontend/core';
import { OrderDetailsFacade } from '../../facades/order-details.facade';

/**
 * 2026-09-16 business-workflow revision — replaces the removed ParcelVerificationCardComponent.
 * The pickup photo is reference/audit evidence only now (no customer approval step, no gate on
 * the delivery OTP — see ProofService's doc comments). This is purely a read-only display: the
 * rider-arrived note and the photo, nothing interactive. Self-contained (reads the facade
 * directly) since it needs two independent pieces of live state.
 */
@Component({
  selector: 'lib-pickup-evidence-card',
  standalone: true,
  templateUrl: './pickup-evidence-card.component.html',
  styleUrl: './pickup-evidence-card.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PickupEvidenceCardComponent {
  protected readonly facade = inject(OrderDetailsFacade);
  private readonly mediaUrlService = inject(MediaUrlService);

  protected readonly pickupPhoto = this.facade.pickupPhoto;
  protected readonly arrivedAtRestaurantAt = this.facade.arrivedAtRestaurantAt;

  protected get photoUrl(): string | undefined {
    return this.mediaUrlService.resolve(this.pickupPhoto()?.storageUrl);
  }
}
