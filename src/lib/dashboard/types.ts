export const orderStatuses = [
  "pending",
  "confirmed",
  "processing",
  "ready",
  "completed",
  "cancelled",
  "refunded",
] as const;

export type OrderStatus = (typeof orderStatuses)[number];
export type InventoryStatus =
  | "pending"
  | "deducted"
  | "needs_recipe"
  | "insufficient_stock"
  | "failed";
export type PaymentStatus = "pending" | "paid" | "failed" | "refunded" | "cancelled";

export type OptionLevelKind = "sugar" | "ice";

export type MenuOptionLevelDTO = {
  id: string;
  kind: OptionLevelKind;
  name: string;
  sortOrder: number;
  isDefault: boolean;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

export type OrderItemDTO = {
  menuItemId: string;
  name: string;
  imageUrl: string;
  size: string;
  sweetness: string | null;
  ice: string | null;
  toppings: Array<{
    id: string;
    name: string;
    category: "standard" | "cream";
    price: number;
  }>;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
};

export type AddressDTO = {
  addressLine1: string;
  addressLine2: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
};

export type OrderDTO = {
  id: string;
  orderNumber: string;
  userId: string | null;
  customerName: string;
  customerEmail: string;
  contactNumber: string;
  items: OrderItemDTO[];
  shippingAddress: AddressDTO;
  subtotal: number;
  discount: number;
  discountCode: string | null;
  discountReason: string | null;
  tax: number;
  tip: number;
  total: number;
  orderStatus: OrderStatus;
  paymentStatus: PaymentStatus;
  inventoryStatus: InventoryStatus;
  inventoryError: string | null;
  paymentMethod: "square_card";
  squareOrderId: string | null;
  squarePaymentId: string | null;
  createdAt: string;
  updatedAt: string;
};

export type CustomerPromoDTO = {
  id: string;
  code: string;
  discountType: "fixed" | "percent";
  discountValue: number;
  status: "available" | "used" | "revoked";
  note: string | null;
  assignedAt: string;
  usedAt: string | null;
  usedOrderId: string | null;
};

export type CustomerDTO = {
  id: string;
  fullName: string;
  email: string;
  profileImageUrl: string | null;
  contactNumber: string;
  address: AddressDTO;
  role: string;
  joinedAt: string;
  updatedAt: string;
  orderCount: number;
  totalSpent: number;
  lastOrderAt: string | null;
  /** Full website order history for this customer. */
  orders: OrderDTO[];
};

