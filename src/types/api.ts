// Legacy minimal types kept for backwards compatibility. Prefer domain.ts.
export interface UserProfile { _id: string; name: string; phone: string; role?: string; }
export interface FeedbackItem { id?: string; _id?: string; createdAt: string; message: string; optimistic?: boolean; }
export interface Ride { _id: string; status: string; fare: number; createdAt: string; finalFare?: number; surgeMultiplier?: number; }
export interface QuoteResponse { total: number; surgeMultiplier: number; payload: string; signature: string; quoteId: string; }
export interface RideRequestResponse { rideId: string; status: string; fare: number; } // simplified
export interface DiagnosticsData { performance?: { httpP95?: number }; httpP95?: number; eventLoopLagMs?: number; uptimeSec?: number; cascades?: { active: number }; }
// NOTE: This file will be deprecated in favor of richer domain models.

