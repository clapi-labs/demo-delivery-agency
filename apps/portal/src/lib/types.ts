export type TripStatus = "pending" | "assigned" | "en_route" | "delivered" | "cancelled";
export type PaymentMethod = "efectivo" | "transferencia";
export type CourierStatus = "available" | "busy" | "paused" | "offline";

export type Trip = {
  id: number;
  code: string;
  status: TripStatus;
  originRestaurantName: string;
  pickupAddress: string | null;
  deliveryAddress: string;
  customerPhone: string;
  valueToCollect: number;
  paymentMethod: PaymentMethod;
  requiresCashReturn: boolean;
  createdAt: string;
  updatedAt: string;
  courierName: string | null;
  courierId: number | null;
  assignedAt: string | null;
  deliveredAt: string | null;
};

export type Courier = {
  id: number;
  name: string;
  phone: string;
  status: CourierStatus;
  lat: number | null;
  lng: number | null;
  locationUpdatedAt: string | null;
  deliveriesThisShift: number;
  shiftStartedAt: string | null;
  active: boolean;
  createdAt: string;
};

export type SettlementRow = {
  courierId: number;
  courierName: string;
  deliveredCount: number;
  cashCollected: number;
};
