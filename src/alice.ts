import type {
  Env,
  FlightCategory,
  FlightLeg,
  FlightResult,
  FlightSearchParams,
  FlightSegmentLeg,
  Layover,
  PassengerPrice,
} from "./types.js";

// ─── Request Builders ────────────────────────────────────────────────────────

// Client for the Alice flight-search API. The endpoint URL and affiliate
// credentials are supplied entirely at runtime (see Env / .env.example) — nothing
// about the upstream is hardcoded here. The API returns three curated, overlapping
// lists (best / cheapest / shortest); we dedupe them by trip id into one
// FlightResult[] and tag each trip with the categories it appeared in (the upstream
// "shortest" list is surfaced as the "fastest" category). See categorizeBestResult.

function buildPassengers(p: FlightSearchParams): Record<string, number> {
  const out: Record<string, number> = {};
  if (p.adults > 0) out.ADT = p.adults;
  if (p.children > 0) out.CHD = p.children;
  if (p.infants > 0) out.INF = p.infants;
  if (p.seniors > 0) out.YCD = p.seniors;
  return out;
}

interface RequestSegment {
  index: number;
  from: { code: string; type: "city" };
  to: { code: string; type: "city" };
  departure: string;
}

function buildSegments(p: FlightSearchParams): RequestSegment[] {
  const segs: RequestSegment[] = [
    {
      index: 1,
      from: { code: p.origin, type: "city" },
      to: { code: p.destination, type: "city" },
      departure: p.departure_date,
    },
  ];
  if (p.return_date) {
    segs.push({
      index: 2,
      from: { code: p.destination, type: "city" },
      to: { code: p.origin, type: "city" },
      departure: p.return_date,
    });
  }
  return segs;
}

// ─── Response Mapper ──────────────────────────────────────────────────────────

interface RawFlight {
  departureDate: string;
  departureAirportLocation: string;
  departureAirportTerminal?: string | null;
  arrivalDate: string;
  arrivalAirportLocation: string;
  arrivalAirportTerminal?: string | null;
  operatingAirline?: string;
  marketingAirline?: string;
  flightNumber: number | string;
  duration?: number;
  cabin?: string;
  brand?: string;
  firstLuggageIncluded?: boolean;
  firstFreeLuggageIncluded?: boolean;
  secondFreeLuggageIncluded?: boolean;
  seatsNumber?: number;
}

interface RawSegment {
  flights: RawFlight[];
}

interface RawPricingDetail {
  passengerType: string;
  totalPrice: number;
}

interface RawResult {
  segments: RawSegment[];
  totalPrice: number;
  flowCurrencyCode: string;
  deepLink: string;
  pricingDetails?: RawPricingDetail[];
  pqId?: string; // stable trip id — used to dedupe across best/cheapest/shortest
}

interface BestResult {
  best?: RawResult[];
  cheapest?: RawResult[];
  shortest?: RawResult[];
}

// The API returns three curated, overlapping lists. Walk them in
// best → cheapest → shortest order, dedupe by pqId (falling back to deepLink,
// then the segment shape) so each trip appears once, and remember every
// category a trip showed up in. The upstream `shortest` list is surfaced as the
// `fastest` category. The returned order is stable: best picks first, then any
// cheapest-only picks, then any fastest-only picks.
function categorizeBestResult(
  result: BestResult
): Array<{ raw: RawResult; categories: FlightCategory[] }> {
  const lists: Array<[FlightCategory, RawResult[] | undefined]> = [
    ["best", result.best],
    ["cheapest", result.cheapest],
    ["fastest", result.shortest],
  ];
  const byKey = new Map<string, { raw: RawResult; categories: FlightCategory[] }>();
  const ordered: Array<{ raw: RawResult; categories: FlightCategory[] }> = [];
  for (const [category, trips] of lists) {
    for (const trip of trips ?? []) {
      const key = trip.pqId ?? trip.deepLink ?? JSON.stringify(trip.segments);
      const existing = byKey.get(key);
      if (existing) {
        if (!existing.categories.includes(category)) existing.categories.push(category);
        continue;
      }
      const entry = { raw: trip, categories: [category] };
      byKey.set(key, entry);
      ordered.push(entry);
    }
  }
  return ordered;
}

function diffMinutes(start: string, end: string): number {
  const ms = new Date(end).getTime() - new Date(start).getTime();
  return Math.max(0, Math.round(ms / 60_000));
}

function mapSegmentToLeg(seg: RawSegment): FlightLeg {
  const flights = seg.flights ?? [];
  const first = flights[0];
  const last = flights[flights.length - 1];

  const mappedFlights: FlightSegmentLeg[] = flights.map((f) => {
    // A checked bag is included if the fare bundles a first bag (free or paid-in).
    const checkedBag = f.firstLuggageIncluded || f.firstFreeLuggageIncluded;
    const leg: FlightSegmentLeg = {
      from: f.departureAirportLocation,
      to: f.arrivalAirportLocation,
      departure_local: f.departureDate,
      arrival_local: f.arrivalDate,
      flight_number: `${f.marketingAirline ?? f.operatingAirline ?? ""}${f.flightNumber}`,
      duration_minutes:
        typeof f.duration === "number"
          ? Math.round(f.duration)
          : diffMinutes(f.departureDate, f.arrivalDate),
    };
    // Only attach optional detail when the upstream actually provided it.
    if (f.cabin) leg.cabin = f.cabin;
    if (f.brand) leg.brand = f.brand;
    if (f.firstLuggageIncluded != null || f.firstFreeLuggageIncluded != null) {
      leg.checked_bag_included = Boolean(checkedBag);
    }
    if (f.departureAirportTerminal) leg.terminal_from = f.departureAirportTerminal;
    if (f.arrivalAirportTerminal) leg.terminal_to = f.arrivalAirportTerminal;
    if (typeof f.seatsNumber === "number") leg.seats_remaining = f.seatsNumber;
    return leg;
  });

  const layovers: Layover[] = [];
  for (let i = 1; i < flights.length; i++) {
    layovers.push({
      airport_code: flights[i - 1].arrivalAirportLocation,
      arrival_local: flights[i - 1].arrivalDate,
      departure_local: flights[i].departureDate,
    });
  }

  // The upstream timestamps are naive local wall-clock strings (no tz offset),
  // so diffing first-departure→last-arrival across a timezone change is wrong
  // (TLV→CDG reads 4h instead of 5h). Instead sum the tz-correct per-flight
  // durations and add the layover gaps — layovers sit at a single airport, so
  // their naive diff is timezone-neutral and safe.
  const flightMinutes = mappedFlights.reduce((sum, f) => sum + f.duration_minutes, 0);
  const layoverMinutes = layovers.reduce(
    (sum, l) => sum + diffMinutes(l.arrival_local, l.departure_local),
    0
  );

  return {
    from: first.departureAirportLocation,
    to: last.arrivalAirportLocation,
    departure_local: first.departureDate,
    arrival_local: last.arrivalDate,
    duration_minutes: flightMinutes + layoverMinutes,
    flights: mappedFlights,
    layovers,
  };
}

function mapPricingDetails(raw: RawPricingDetail[] | undefined): PassengerPrice[] {
  return (raw ?? [])
    .filter((d) => ["ADT", "CHD", "INF", "YCD"].includes(d.passengerType))
    .map((d) => ({
      passenger_type: d.passengerType as PassengerPrice["passenger_type"],
      total_price: d.totalPrice,
    }));
}

// The bookable count for the whole trip is the tightest flight on it.
export function tripSeatsRemaining(legs: FlightLeg[]): number | undefined {
  const counts = legs
    .flatMap((l) => l.flights)
    .map((f) => f.seats_remaining)
    .filter((n): n is number => typeof n === "number");
  return counts.length ? Math.min(...counts) : undefined;
}

function mapToFlightResult(raw: RawResult, categories: FlightCategory[]): FlightResult {
  const segments = raw.segments ?? [];
  const outbound = mapSegmentToLeg(segments[0]);
  const inbound = segments[1] ? mapSegmentToLeg(segments[1]) : undefined;

  const seats = tripSeatsRemaining(inbound ? [outbound, inbound] : [outbound]);
  const result: FlightResult = {
    outbound,
    inbound,
    price: raw.totalPrice,
    currency: raw.flowCurrencyCode,
    deep_link: raw.deepLink,
    pricing_details: mapPricingDetails(raw.pricingDetails),
    categories,
  };
  if (seats !== undefined) result.seats_remaining = seats;
  return result;
}

// ─── Public API ──────────────────────────────────────────────────────────────

// Upstream can be slow or hang; bound every call so a stuck request surfaces a
// clean error instead of hanging the MCP tool call.
const REQUEST_TIMEOUT_MS = 15_000;
const MAX_ATTEMPTS = 2; // one retry, only for transient failures (network / 5xx / masked 400)

// The upstream can wrap an internal failure in a catch-all that returns HTTP 400
// with the JSON empty-string body `""` (seen on very large searches). A genuine
// validation reject returns 400 with an *empty* body, so the `""` body is the
// fingerprint of a masked internal error — flaky, and worth retrying rather than
// treating as a bad request.
function isMaskedUpstreamException(status: number, bodyText: string): boolean {
  return status === 400 && bodyText.trim() === '""';
}

async function postSearch(
  url: string,
  body: string,
  headers: Record<string, string>
): Promise<Response> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    try {
      const response = await fetch(url, {
        method: "POST",
        headers,
        body,
        signal: controller.signal,
      });
      // Retry once on transient upstream errors; return everything else as-is.
      if (response.status >= 500 && attempt < MAX_ATTEMPTS) {
        lastError = new Error(`Flight search HTTP ${response.status}`);
        continue;
      }
      if (response.status === 400 && attempt < MAX_ATTEMPTS) {
        // Peek at the body to tell a masked internal error (transient, retry)
        // from a genuine validation reject (return as-is).
        const bodyText = await response.text().catch(() => "");
        if (isMaskedUpstreamException(response.status, bodyText)) {
          lastError = new Error("Flight search HTTP 400 (masked internal error)");
          continue;
        }
        // The peek consumed the body — rebuild an equivalent response.
        return new Response(bodyText, { status: response.status });
      }
      return response;
    } catch (err) {
      lastError =
        err instanceof Error && err.name === "AbortError"
          ? new Error(`Flight search request timed out after ${REQUEST_TIMEOUT_MS / 1000}s.`)
          : err;
      if (attempt >= MAX_ATTEMPTS) break;
    } finally {
      clearTimeout(timer);
    }
  }
  throw lastError instanceof Error ? lastError : new Error("Flight search request failed");
}

export async function searchFlights(
  env: Env,
  params: FlightSearchParams
): Promise<FlightResult[]> {
  if (!env.ALICE_API_URL) {
    throw new Error(
      "Missing ALICE_API_URL. Set it to the Alice flight-search API endpoint (see .env.example)."
    );
  }
  if (!env.ALICE_AFFILIATE_ID || !env.ALICE_SECRET) {
    throw new Error(
      "Missing ALICE_AFFILIATE_ID or ALICE_SECRET. Set them as environment variables " +
        "(see .env.example). These are Alice affiliate credentials — contact Alice to obtain them."
    );
  }

  const response = await postSearch(
    env.ALICE_API_URL,
    JSON.stringify({
      affiliateId: env.ALICE_AFFILIATE_ID,
      secret: env.ALICE_SECRET,
      flightClass: params.flight_class,
      passengers: buildPassengers(params),
      segments: buildSegments(params),
    }),
    { "Content-Type": "application/json" }
  );

  if (!response.ok) {
    // Log the upstream body to stderr for diagnostics, but don't surface it to
    // the MCP client — it can carry internal details. Return a generic message.
    const upstreamBody = await response.text().catch(() => "");
    console.error(
      `[alice] upstream search HTTP ${response.status}: ${upstreamBody.slice(0, 500)}`
    );
    if (isMaskedUpstreamException(response.status, upstreamBody)) {
      throw new Error(
        "The flight search service hit a temporary internal error (this can " +
          "happen on very large searches). Please try the search again in a moment."
      );
    }
    throw new Error(`Flight search failed upstream (HTTP ${response.status}).`);
  }

  const body = (await response.json()) as {
    success?: boolean;
    result?: BestResult;
    errors?: unknown[];
  };

  if (!body.success) {
    const errs = Array.isArray(body.errors)
      ? body.errors.map((e) => String(e)).join("; ")
      : "unknown error";
    throw new Error(`Flight search failed: ${errs}`);
  }

  const categorized = body.result ? categorizeBestResult(body.result) : [];
  return categorized.map(({ raw, categories }) => mapToFlightResult(raw, categories));
}
