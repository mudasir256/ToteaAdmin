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

export type OrderItemDTO = {
  menuItemId: string;
  name: string;
  imageUrl: string;
  size: string;
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

export type CustomerDTO = {
  id: string;
  fullName: string;
  email: string;
  profileImageUrl: string | null;
  contactNumber: string;
  address: AddressDTO;
  joinedAt: string;
  orderCount: number;
  totalSpent: number;
  lastOrderAt: string | null;
  recentOrders: Array<{
    id: string;
    orderNumber: string;
    total: number;
    orderStatus: OrderStatus;
    paymentStatus: PaymentStatus;
    createdAt: string;
  }>;
};

