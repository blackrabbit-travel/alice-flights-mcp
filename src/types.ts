// ─── Search Input ────────────────────────────────────────────────────────────

export type FlightClass = "tour" | "tourPlus" | "business" | "first";

export interface FlightSearchParams {
  origin: string;
  destination: string;
  departure_date: string;
  return_date?: string;
  adults: number;
  children: number;
  infants: number;
  seniors: number;
  flight_class: FlightClass;
}

// ─── API Response Shapes ─────────────────────────────────────────────────────

export interface Layover {
  airport_code: string;
  arrival_local: string;
  departure_local: string;
}

export interface FlightSegmentLeg {
  from: string;
  to: string;
  departure_local: string;
  arrival_local: string;
  flight_number: string;
  duration_minutes: number;
  // Optional fare/amenity detail. Absent when the upstream doesn't return it —
  // callers must treat every field as maybe-undefined.
  cabin?: string; // raw cabin code, e.g. "Y" (economy), "C"/"J" (business), "F" (first)
  brand?: string; // fare brand, e.g. "LITE", "FLEX", "ECOSAVER"
  checked_bag_included?: boolean; // a checked bag is included in the fare
  seats_remaining?: number; // seats left in this booking class (absent when upstream omits it)
  terminal_from?: string;
  terminal_to?: string;
}

export interface FlightLeg {
  from: string;
  to: string;
  departure_local: string;
  arrival_local: string;
  duration_minutes: number;
  flights: FlightSegmentLeg[];
  layovers: Layover[];
}

export interface PassengerPrice {
  passenger_type: "ADT" | "CHD" | "INF" | "YCD";
  total_price: number;
}

// Which curated selection(s) a flight belongs to. The upstream search returns
// three overlapping picks; a single flight can be in more than one:
//   best     — the engine's recommended balance of price, duration, and stops
//   cheapest — lowest total price
//   fastest  — shortest total travel time (upstream calls this "shortest")
export type FlightCategory = "best" | "cheapest" | "fastest";

export interface FlightResult {
  outbound: FlightLeg;
  inbound?: FlightLeg;
  price: number;
  currency: string;
  deep_link: string;
  pricing_details: PassengerPrice[];
  // Min seats_remaining across every flight on the trip — the number actually
  // bookable at this price. Absent when the upstream doesn't report seats.
  seats_remaining?: number;
  // The categories this flight was selected into (one or more of the above).
  categories: FlightCategory[];
}

// ─── Configuration ───────────────────────────────────────────────────────────
// Everything is supplied at runtime via environment variables (see .env.example)
// — nothing is hardcoded. The server boots without these; searches return a clear
// error if they are unset.

export interface Env {
  // Full URL of the Alice flight-search API endpoint (issued by Alice).
  ALICE_API_URL: string;

  // Alice affiliate credentials.
  ALICE_AFFILIATE_ID: string;
  ALICE_SECRET: string;
}
