/// <reference types="google.maps" />
import type { AddressPreview } from '../../models/map-picker.models';

/** Extracts the address-line/city/state/postalCode/country shape the address preview and every
 *  Address form needs out of Google's verbose `address_components` array. */
export function parseGoogleAddressComponents(
  components: google.maps.GeocoderAddressComponent[] | undefined,
  formattedAddress: string | undefined,
): AddressPreview {
  const byType = (type: string) =>
    components?.find((component) => component.types.includes(type))?.long_name;

  const streetNumber = byType('street_number');
  const route = byType('route');
  const addressLine1 = [streetNumber, route].filter(Boolean).join(' ') || byType('premise') || undefined;

  return {
    formattedAddress,
    addressLine1,
    city: byType('locality') ?? byType('postal_town') ?? byType('sublocality'),
    state: byType('administrative_area_level_1'),
    postalCode: byType('postal_code'),
    country: byType('country'),
  };
}
