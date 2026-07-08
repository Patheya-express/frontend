export interface CartItemAddonOption {
  id: string;
  name: string;
  price: number;
}

export interface CartItem {
  id: string;
  menuItemId: string;
  name: string;
  imageUrl?: string;
  variantId?: string;
  variantName?: string;
  unitPrice: number;
  addonOptions: CartItemAddonOption[];
  quantity: number;
  lineTotal: number;
  specialInstructions?: string;
  isAvailable: boolean;
}
