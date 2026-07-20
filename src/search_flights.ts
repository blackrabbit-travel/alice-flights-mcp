import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { searchFlights } from "./alice.js";
import type { Env, FlightLeg, FlightResult } from "./types.js";

// ─── Input Schema ─────────────────────────────────────────────────────────────

const FlightClassEnum = z.enum(["tour", "tourPlus", "business", "first"]);

const SearchFlightsInput = {
  origin: z
    .string()
    .length(3)
    .describe("3-letter IATA city or airport code (e.g. 'TLV', 'LON', 'MAD')"),
  destination: z
    .string()
    .length(3)
    .describe("3-letter IATA city or airport code (e.g. 'TLV', 'LON', 'MAD')"),
  departure_date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Must be YYYY-MM-DD")
    .describe("Departure date in YYYY-MM-DD format"),
  return_date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Must be YYYY-MM-DD")
    .optional()
    .describe("Return date for round trips (YYYY-MM-DD). Omit for one-way."),
  adults: z
    .number()
    .int()
    .min(0)
    .max(9)
    .default(1)
    .describe("Number of adult passengers (0–9)"),
  children: z
    .number()
    .int()
    .min(0)
    .max(9)
    .default(0)
    .describe("Number of child passengers (0–9)"),
  infants: z
    .number()
    .int()
    .min(0)
    .max(9)
    .default(0)
    .describe("Number of infant passengers (0–9)"),
  seniors: z
    .number()
    .int()
    .min(0)
    .max(9)
    .default(0)
    .describe("Number of senior passengers (0–9)"),
  flight_class: FlightClassEnum.default("tour").describe(
    "Cabin class: tour (economy), tourPlus (premium economy), business, or first"
  ),
};

// ─── Output Formatting ──────────────────────────────────────────────────────

function formatDuration(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

function legLine(leg: FlightLeg): string {
  const stops =
    leg.layovers.length === 0
      ? "nonstop"
      : `${leg.layovers.length} stop${leg.layovers.length > 1 ? "s" : ""} via ${leg.layovers
          .map((l) => l.airport_code)
          .join(", ")}`;
  const flights = leg.flights.map((f) => f.flight_number).join(" / ");
  return `${leg.from}→${leg.to} ${leg.departure_local} → ${leg.arrival_local} (${formatDuration(
    leg.duration_minutes
  )}, ${stops}; ${flights})`;
}

function summaryText(
  origin: string,
  destination: string,
  departureDate: string,
  returnDate: string | undefined,
  results: FlightResult[]
): string {
  const tripType = returnDate ? "round trip" : "one-way";
  const header = `Found ${results.length} flight option(s) ${origin}→${destination} on ${departureDate}${
    returnDate ? ` returning ${returnDate}` : ""
  } (${tripType}):`;

  const lines = results.map((r, i) => {
    const cats = r.categories.join(", ");
    const lowSeats =
      r.seats_remaining !== undefined && r.seats_remaining > 0 && r.seats_remaining <= 4
        ? ` — only ${r.seats_remaining} seat${r.seats_remaining > 1 ? "s" : ""} left`
        : "";
    const outbound = `    outbound: ${legLine(r.outbound)}`;
    const inbound = r.inbound ? `\n    return:   ${legLine(r.inbound)}` : "";
    return `${i + 1}. [${cats}] ${r.price} ${r.currency}${lowSeats}\n${outbound}${inbound}\n    book: ${r.deep_link}`;
  });

  return `${header}\n\n${lines.join("\n\n")}`;
}

// ─── Tool Registration ────────────────────────────────────────────────────────

export function registerSearchFlights(server: McpServer, env: Env) {
  server.registerTool(
    "search_flights",
    {
      title: "Search Flights",
      description:
        "Search for available flights between two cities. Returns a curated set of " +
        "options, each tagged with one or more categories:\n" +
        "- **best**: the engine's recommended balance of price, total duration, and stops.\n" +
        "- **cheapest**: lowest total price.\n" +
        "- **fastest**: shortest total travel time.\n" +
        "The categories overlap — a single flight can be both best and cheapest. " +
        "Each option includes price, total durations, layovers, its `categories`, and a direct " +
        "booking link. Options may include `seats_remaining` — the number of seats left in this " +
        "booking class at this price; values of 4 or fewer indicate limited availability.",
      inputSchema: SearchFlightsInput,
      annotations: { title: "Search Flights", readOnlyHint: true, openWorldHint: true },
    },
    async (input) => {
      try {
        if (input.adults + input.children + input.infants + input.seniors < 1) {
          return {
            content: [{ type: "text", text: "At least one passenger is required." }],
            isError: true,
          };
        }

        const results = await searchFlights(env, input);

        if (results.length === 0) {
          return {
            content: [
              {
                type: "text",
                text: "No flights found for the given search criteria. Try different dates or nearby airports.",
              },
            ],
          };
        }

        const MAX_RESULTS = 30;
        const trimmed = results.slice(0, MAX_RESULTS);
        return {
          content: [
            {
              type: "text",
              text: summaryText(
                input.origin.toUpperCase(),
                input.destination.toUpperCase(),
                input.departure_date,
                input.return_date,
                trimmed
              ),
            },
          ],
          structuredContent: { total: results.length, results: trimmed },
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown error";
        console.error("[search_flights] Error:", message);
        return {
          content: [{ type: "text", text: `Error searching flights: ${message}` }],
          isError: true,
        };
      }
    }
  );
}
