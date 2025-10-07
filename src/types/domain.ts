// Domain-centric enriched types based on blueprint spec.
export type Role = 'rider' | 'driver' | 'admin';
export interface AuthTokens { accessToken: string; refreshToken?: string; userId?: string; driverId?: string; }
export interface SessionMeta { userId?: string; driverId?: string; role: Role; scopes?: string[]; exp: number; }
export type LatLng = { lat: number; lng: number };
export type RideStatus = 'matching' | 'matched' | 'assigned' | 'pickup_arrived' | 'in_progress' | 'completed' | 'cancelled';
export interface Ride {
  _id: string;
  status: RideStatus;
  pickup?: LatLng; // legacy placeholder until backend returns full shape
  dropoff?: LatLng;
  fare: number;
  finalFare?: number;
  surgeVersion?: string;
  surgeMultiplier?: number;
  createdAt: string;
  updatedAt?: string;
  matchedAt?: string;
  acceptedAt?: string;
  pickupArrivalAt?: string;
  tripStartAt?: string;
  completedAt?: string;
}
export interface Payment {
  _id: string;
  rideId: string;
  status: 'initiated' | 'authorized' | 'captured' | 'refunded';
  amount: number;
  currency?: string;
  capturedAmount?: number;
  refundedAmount?: number;
  updatedAt: string;
}
export interface FeedbackItemVersioned { _id: string; createdAt: string; message: string; updatedAt?: string; }
export interface Delivery { _id: string; status: string; createdAt: string; updatedAt?: string; instructions?: string; }
export interface FeatureFlagsMap { [key: string]: boolean | number | string; }

// Cache entry with ETag for GET resources
export interface ETagCacheEntry<T> { etag: string; value: T; updatedAt: number; }
