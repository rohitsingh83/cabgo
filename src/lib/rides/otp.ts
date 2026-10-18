/**
 * Ride Start OTP generation and verification.
 * In ride-hailing (Uber/Ola), a 4-digit PIN is generated upon booking.
 * The passenger shares this with the driver upon arrival, and the driver must
 * enter and verify it before the ride can transition to `in_progress`.
 */

export function generateRideOtp(): string {
  return Math.floor(1000 + Math.random() * 9000).toString();
}

/**
 * Returns the 4-digit OTP for a ride.
 * If the ride has an explicit `otp` property, that is returned.
 * Otherwise, a deterministic 4-digit code is derived from the ride's UUID so that
 * seeded or existing rides always have a consistent, valid verification code.
 */
export function getRideOtp(ride: { id: string; otp?: string | null }): string {
  if (ride.otp && /^\d{4}$/.test(ride.otp)) {
    return ride.otp;
  }
  // Deterministic 4-digit fallback from UUID characters
  let hash = 0;
  for (let i = 0; i < ride.id.length; i++) {
    hash = (hash << 5) - hash + ride.id.charCodeAt(i);
    hash |= 0;
  }
  const code = (Math.abs(hash) % 9000) + 1000;
  return code.toString();
}

/**
 * Validates whether the driver-submitted OTP matches the ride OTP.
 */
export function verifyRideOtp(ride: { id: string; otp?: string | null }, submittedOtp: string): boolean {
  const expected = getRideOtp(ride);
  return submittedOtp.trim() === expected;
}
