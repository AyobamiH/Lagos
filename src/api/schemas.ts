import { z } from 'zod';

export const UserSchema = z.object({
  userId: z.string().optional(), // backend sometimes returns userId separately
  _id: z.string().optional(),
  role: z.enum(['rider','driver']).optional(),
  name: z.string().optional(),
  phone: z.string().optional()
});
export type User = z.infer<typeof UserSchema>;

export const AuthResponseSchema = z.object({
  accessToken: z.string().optional(),
  token: z.string().optional(), // some legacy responses
  refreshToken: z.string().optional(),
  userId: z.string().optional()
});
export type AuthResponse = z.infer<typeof AuthResponseSchema>;

// Expanded ride summary schema to retain surge + product + eta context returned by backend
export const RideSummarySchema = z.object({
  _id: z.string(),
  status: z.string(),
  fare: z.number().optional(),
  createdAt: z.string(),
  productType: z.string().optional(),
  surgeMultiplier: z.number().optional(),
  surgeVersion: z.number().optional(),
  eta: z.number().optional(),
  etaMinutes: z.number().optional(),
  finalFare: z.number().optional()
}).passthrough();
export type RideSummary = z.infer<typeof RideSummarySchema>;

export const RidesPageSchema = z.object({
  rides: z.array(RideSummarySchema),
  nextCursor: z.string().optional()
});
export type RidesPage = z.infer<typeof RidesPageSchema>;

export const RideDetailSchema = RideSummarySchema.extend({
  finalFare: z.number().optional(),
  cancellation: z.any().optional()
});
export type RideDetail = z.infer<typeof RideDetailSchema>;

// Ride request creation response (server returns enriched fields)
export const RideRequestResponseSchema = z.object({
  rideId: z.string(),
  fare: z.number().optional(),
  etaMinutes: z.number().optional(),
  status: z.string(),
  queueId: z.any().optional(),
  quoteApplied: z.boolean().optional(),
  surgeMultiplier: z.number().optional(),
  surgeVersion: z.number().optional(),
  fareBreakdown: z.any().optional()
}).passthrough();
export type RideRequestResponse = z.infer<typeof RideRequestResponseSchema>;

// Fare / receipt related schemas
export const FareBreakdownSchema = z.object({
  baseFare: z.number().optional(),
  distanceComponent: z.number().optional(),
  timeComponent: z.number().optional(),
  surgeMultiplier: z.number().optional(),
  surgeVersion: z.number().optional(),
  total: z.number().optional()
}).passthrough();

export const ReceiptSchema = z.object({
  rideId: z.string(),
  riderId: z.string().optional(),
  fare: z.number().optional(),
  finalFare: z.number().optional(),
  currency: z.string().optional(),
  breakdown: FareBreakdownSchema.optional(),
  createdAt: z.string().optional()
}).passthrough();
export type Receipt = z.infer<typeof ReceiptSchema>;

export const RideStatusEventSchema = z.object({
  rideId: z.string(),
  status: z.string().optional(),
  seq: z.number().optional(),
  emittedAt: z.number().optional()
}).passthrough();
export type RideStatusEvent = z.infer<typeof RideStatusEventSchema>;

// Realtime driver position event (emitted to rider while a ride is active)
export const DriverPositionEventSchema = z.object({
  rideId: z.string(),
  driverId: z.string().optional(),
  lat: z.number(),
  lng: z.number(),
  heading: z.number().optional(),
  ts: z.number().optional()
}).passthrough();
export type DriverPositionEvent = z.infer<typeof DriverPositionEventSchema>;

// Quote schema (runtime validation for pricing service response)
export const QuoteSchema = z.object({
  total: z.number(),
  surgeMultiplier: z.number().optional(),
  payload: z.any().optional(), // opaque payload used for signed quotes
  signature: z.string().optional(),
  quoteId: z.string().optional(),
  expiresAt: z.union([z.number(), z.string()]).optional()
}).passthrough();
export type Quote = z.infer<typeof QuoteSchema>;

// Feature flags schema (loose – allow unknown keys)
export const FeatureFlagsSchema = z.record(z.any());
export type FeatureFlags = z.infer<typeof FeatureFlagsSchema>;

// Diagnostics schema (partial; passthrough to avoid breakage on new fields)
export const DiagnosticsSchema = z.object({
  httpP95: z.number().optional(),
  performance: z.any().optional(),
  eventLoopLagMs: z.number().optional(),
  cascades: z.any().optional(),
  uptimeSec: z.number().optional(),
  config: z.any().optional()
}).passthrough();
export type Diagnostics = z.infer<typeof DiagnosticsSchema>;

// Driver availability snapshot
export const AvailabilitySnapshotSchema = z.object({
  total: z.number(),
  available: z.number(),
  busy: z.number()
}).passthrough();
export type AvailabilitySnapshot = z.infer<typeof AvailabilitySnapshotSchema>;

// Payments
export const PaymentSchema = z.object({
  _id: z.string().optional(),
  paymentId: z.string().optional(),
  rideId: z.string().optional(),
  userId: z.string().optional(),
  method: z.string().optional(),
  amount: z.number().optional(),
  currency: z.string().optional(),
  status: z.string().optional(),
  capturedAmount: z.number().optional(),
  refundedAmount: z.number().optional(),
  createdAt: z.union([z.string(), z.number()]).optional(),
  updatedAt: z.union([z.string(), z.number()]).optional(),
  authorizedAt: z.union([z.string(), z.number()]).optional(),
  capturedAt: z.union([z.string(), z.number()]).optional(),
  refundedAt: z.union([z.string(), z.number()]).optional()
}).passthrough();
export type Payment = z.infer<typeof PaymentSchema>;

// Adjustments (simplified result shape from controller services)
export const AdjustmentSchema = z.object({
  rideId: z.string().optional(),
  type: z.string().optional(),
  amount: z.number().optional(),
  currency: z.string().optional(),
  note: z.string().optional(),
  version: z.number().optional(),
  reversed: z.boolean().optional(),
  at: z.union([z.string(), z.number()]).optional()
}).passthrough();
export type Adjustment = z.infer<typeof AdjustmentSchema>;

// Surge version metadata (loose schema)
export const SurgeVersionSchema = z.object({
  version: z.number().optional(),
  createdAt: z.union([z.string(), z.number()]).optional(),
  notes: z.string().optional(),
  active: z.boolean().optional(),
  baseMultiplier: z.number().optional(),
  grid: z.any().optional()
}).passthrough();
export type SurgeVersion = z.infer<typeof SurgeVersionSchema>;

// Offer schema (driver side offers)
export const OfferSchema = z.object({
  rideId: z.string(),
  fare: z.number().optional(),
  eta: z.number().optional(),
  status: z.string().optional(),
  createdAt: z.number().optional(),
  surgeMultiplier: z.number().optional()
}).passthrough();
export type Offer = z.infer<typeof OfferSchema>;

// Feedback schema
export const FeedbackItemSchema = z.object({
  _id: z.string().optional(),
  id: z.string().optional(),
  createdAt: z.string(),
  message: z.string(),
  optimistic: z.boolean().optional()
});
export type FeedbackItem = z.infer<typeof FeedbackItemSchema>;

// Manual Assign result schema
export const ManualAssignResultSchema = z.object({
  rideId: z.string(),
  driverId: z.string(),
  assigned: z.boolean().optional(),
  status: z.string().optional(),
  correlationId: z.string().optional()
}).passthrough();
export type ManualAssignResult = z.infer<typeof ManualAssignResultSchema>;

export const ErrorResponseSchema = z.object({
  error: z.string(),
  code: z.string().optional(),
  details: z.any().optional()
}).passthrough();
export type ErrorResponse = z.infer<typeof ErrorResponseSchema>;

export function extractAccessToken(a: AuthResponse) {
  return a.accessToken || a.token || null;
}
