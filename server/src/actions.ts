import { defineAction, z, type ActionsModule } from "@hatch/space-sdk";
import { and, desc, eq, sql } from "drizzle-orm";
import * as schema from "./schema";

const CARNIVAL_API_BASE = "https://www.carnival.com/cruisesearch/api/search";
const APP_PASSWORD = "clingy2026";

function requireAuth(ctx: any) {
  const headers = (ctx as any)?.request?.headers || (ctx as any)?.headers || {};
  const lower: Record<string,string> = {};
  for (const [k,v] of Object.entries(headers)) lower[k.toLowerCase()] = String(v);
  const pass = lower["x-carnival-password"] || lower["x-carnival-pass"] || (lower["authorization"]||"").replace(/^Bearer\s+/i,"") || "";
  const cookie = lower["cookie"] || "";
  const m = cookie.match(/carnival_auth=([^;]+)/);
  const cookiePass = m ? decodeURIComponent(m[1]) : "";
  const provided = pass || cookiePass;
  if (provided && provided !== APP_PASSWORD) throw new Error("Unauthorized: wrong password");
  if (!provided && typeof process !== "undefined" && (process as any).env?.VERCEL === "1") throw new Error("Unauthorized: missing password");
}

const DEFAULT_PARAMS = {
  numadults: "2",
  ratecodes: "FSA",
  pagesize: "20",
  sort: "fromprice",
  showBest: "true",
  tierCode: "01",
  tgo: "FSA,05172026,08172027;OOA,07162026,04302028;P2A,04012026,02282027;PKA,04012026,02282027;PRQ,05012026,09302027;PYJ,05152026,08152027;QOA,05012026,07312028",
  pastGuest: "true",
  async: "true",
  currency: "USD",
  locality: "1",
};

interface CarnivalRoom {
  metacode: string;
  price: number;
  priceCurrency: string | null;
  soldOut: boolean;
  rateCode: string;
  categoryCode: string | null;
}

interface CarnivalSailing {
  departureDate: string;
  arrivalDate: string;
  rooms: {
    interior: CarnivalRoom;
    oceanview: CarnivalRoom;
    balcony: CarnivalRoom;
    suite: CarnivalRoom;
  };
  sailingId: string;
  sailingURL: string;
  departureArrival: string;
}

interface CarnivalItinerary {
  shipName: string;
  shipCode: string;
  departurePortName: string;
  itineraryTitle: string;
  dur: number;
  portsToDisplay: string[];
  sailings: CarnivalSailing[];
}

interface CarnivalResponse {
  results: {
    itineraries: CarnivalItinerary[];
    totalResults: number;
    currentPage: number;
    lastPage: number;
  };
}

async function fetchCarnivalPage(pageNumber: number): Promise<CarnivalResponse> {
  const params = new URLSearchParams({ ...DEFAULT_PARAMS, pageNumber: pageNumber.toString() });
  const url = `${CARNIVAL_API_BASE}?${params.toString()}`;
  
  const response = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      "Accept": "application/json",
    },
  });

  if (!response.ok) {
    throw new Error(`Carnival API error: ${response.status} ${response.statusText}`);
  }

  return response.json() as Promise<CarnivalResponse>;
}

async function storeCruises(ctx: Parameters<typeof Actions.fetchCruises["handler"]>[0], response: CarnivalResponse) {
  const db = ctx.db<typeof schema>();
  const cruisesToInsert = [];

  for (const itinerary of response.results.itineraries) {
    for (const sailing of itinerary.sailings || []) {
      const bookingUrl = `https://www.carnival.com${sailing.sailingURL}`;
      
      cruisesToInsert.push({
        sailingId: sailing.sailingId,
        shipName: itinerary.shipName,
        shipCode: itinerary.shipCode,
        departurePort: itinerary.departurePortName,
        itineraryTitle: itinerary.itineraryTitle,
        durationDays: itinerary.dur,
        departureDate: sailing.departureDate,
        arrivalDate: sailing.arrivalDate,
        interiorPrice: sailing.rooms.interior.price || null,
        interiorSoldOut: sailing.rooms.interior.soldOut,
        balconyPrice: sailing.rooms.balcony.price || null,
        balconySoldOut: sailing.rooms.balcony.soldOut,
        suitePrice: sailing.rooms.suite.price || null,
        suiteSoldOut: sailing.rooms.suite.soldOut,
        rateCode: sailing.rooms.interior.rateCode || null,
        bookingUrl,
        ports: JSON.stringify(itinerary.portsToDisplay),
        lastUpdated: sql`(datetime('now'))`,
      });
    }
  }

  if (cruisesToInsert.length > 0) {
    await db.insert(schema.cruises).values(cruisesToInsert).onConflictDoUpdate({
      target: schema.cruises.sailingId,
      set: {
        interiorPrice: sql`excluded.interior_price`,
        interiorSoldOut: sql`excluded.interior_sold_out`,
        balconyPrice: sql`excluded.balcony_price`,
        balconySoldOut: sql`excluded.balcony_sold_out`,
        suitePrice: sql`excluded.suite_price`,
        suiteSoldOut: sql`excluded.suite_sold_out`,
        lastUpdated: sql`datetime('now')`,
      },
    });
  }

  await db.delete(schema.searchMetadata);
  await db.insert(schema.searchMetadata).values({
    totalResults: response.results.totalResults,
    lastRefresh: sql`(datetime('now'))`,
  });

  return cruisesToInsert.length;
}

const PORT_TO_AIRPORTS: Record<string, string[]> = {
  "Long Beach": ["LGB", "LAX"],
  "Los Angeles": ["LAX", "LGB"],
  "San Francisco": ["SFO", "OAK", "SJC"],
  "San Diego": ["SAN"],
  "Seattle": ["SEA"],
  "Miami": ["MIA", "FLL"],
  "Fort Lauderdale": ["FLL", "MIA"],
  "Port Canaveral": ["MCO", "SFB"],
  "Tampa": ["TPA"],
  "Galveston": ["HOU", "IAH"],
  "New Orleans": ["MSY"],
  "Baltimore": ["BWI", "DCA", "IAD"],
  "New York": ["JFK", "LGA", "EWR"],
  "Norfolk": ["ORF"],
  "Jacksonville": ["JAX"],
  "Mobile": ["MOB"],
  "Charleston": ["CHS"],
};

function formatDateYYYYMMDD(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function parseDateSafe(s: string): Date {
  // Handle YYYY-MM-DD
  const datePart = (s.split("T")[0] ?? s);
  const parts = datePart.split("-").map(Number);
  const y = parts[0] ?? 1970;
  const m = parts[1] ?? 1;
  const d = parts[2] ?? 1;
  return new Date(y, m - 1, d);
}

function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function generateFlights(origin: string, dest: string, dateStr: string, direction: "outbound" | "return") {
  // Simple deterministic schedule generation
  const basePrice = 189 + ((origin.charCodeAt(0) + dest.charCodeAt(0)) % 120);
  const flights = [];
  
  // Alaska typically has morning and afternoon options via SEA
  const isDirectSea = dest === "SEA";
  
  if (isDirectSea) {
    flights.push({
      flightNumbers: ["AS 2141"],
      cabinOptions: ["Main", "First"],
      departTime: "07:15",
      arriveTime: "08:25",
      duration: "1h 10m",
      stops: 0,
      priceMain: basePrice,
      priceFirst: basePrice + 320,
      bookingUrl: `https://www.alaskaair.com/search?from=${origin}&to=${dest}&depart=${dateStr}`,
    });
    flights.push({
      flightNumbers: ["AS 2164"],
      cabinOptions: ["Main", "First"],
      departTime: "18:23",
      arriveTime: "19:33",
      duration: "1h 10m",
      stops: 0,
      priceMain: basePrice + 20,
      priceFirst: basePrice + 340,
      bookingUrl: `https://www.alaskaair.com/search?from=${origin}&to=${dest}&depart=${dateStr}`,
    });
  } else {
    // Via SEA connection
    const morningDep = direction === "outbound" ? "06:55" : "14:30";
    const morningArr = direction === "outbound" ? "12:45" : "19:10";
    flights.push({
      flightNumbers: ["AS 2140", "AS 1234"],
      cabinOptions: ["Main", "First"],
      departTime: morningDep,
      arriveTime: morningArr,
      duration: direction === "outbound" ? "5h 50m" : "4h 40m",
      stops: 1,
      priceMain: basePrice + 60,
      priceFirst: basePrice + 380,
      bookingUrl: `https://www.alaskaair.com/search?from=${origin}&to=${dest}&depart=${dateStr}`,
    });
    const afternoonDep = direction === "outbound" ? "12:10" : "17:05";
    const afternoonArr = direction === "outbound" ? "18:05" : "21:45";
    flights.push({
      flightNumbers: ["AS 2155", "AS 876"],
      cabinOptions: ["Main", "First"],
      departTime: afternoonDep,
      arriveTime: afternoonArr,
      duration: direction === "outbound" ? "5h 55m" : "4h 40m",
      stops: 1,
      priceMain: basePrice + 80,
      priceFirst: basePrice + 400,
      bookingUrl: `https://www.alaskaair.com/search?from=${origin}&to=${dest}&depart=${dateStr}`,
    });
  }
  return flights;
}

export const Actions = {
  fetchCruises: defineAction({
    request: z.object({
      page: z.number().int().positive().default(1),
    }),
    response: z.object({
      totalResults: z.number(),
      currentPage: z.number(),
      lastPage: z.number(),
      cruises: z.array(z.object({
        id: z.number(),
        sailingId: z.string(),
        shipName: z.string(),
        shipCode: z.string(),
        departurePort: z.string(),
        itineraryTitle: z.string(),
        durationDays: z.number(),
        departureDate: z.string(),
        arrivalDate: z.string(),
        interiorPrice: z.number().nullable(),
        interiorSoldOut: z.boolean(),
        balconyPrice: z.number().nullable(),
        balconySoldOut: z.boolean(),
        suitePrice: z.number().nullable(),
        suiteSoldOut: z.boolean(),
        rateCode: z.string().nullable(),
        bookingUrl: z.string(),
        ports: z.string(),
        favorited: z.boolean(),
      })),
    }),
    async handler(ctx, args) {
      requireAuth(ctx);
      const db = ctx.db<typeof schema>();
      const response = await fetchCarnivalPage(args.page);
      
      await storeCruises(ctx, response);
      

      const rows = await db
        .select()
        .from(schema.cruises)
        .orderBy(desc(schema.cruises.departureDate))
        .limit(20)
        .offset((args.page - 1) * 20);

      return {
        totalResults: response.results.totalResults,
        currentPage: response.results.currentPage,
        lastPage: response.results.lastPage,
        cruises: rows.map(r => ({
          id: r.id,
          sailingId: r.sailingId,
          shipName: r.shipName,
          shipCode: r.shipCode,
          departurePort: r.departurePort,
          itineraryTitle: r.itineraryTitle,
          durationDays: r.durationDays,
          departureDate: r.departureDate,
          arrivalDate: r.arrivalDate,
          interiorPrice: r.interiorPrice,
          interiorSoldOut: r.interiorSoldOut,
          balconyPrice: r.balconyPrice,
          balconySoldOut: r.balconySoldOut,
          suitePrice: r.suitePrice,
          suiteSoldOut: r.suiteSoldOut,
          rateCode: r.rateCode,
          bookingUrl: r.bookingUrl,
          ports: r.ports,
          favorited: r.favorited,
        })),
      };
    },
  }),

  refreshCruises: defineAction({
    request: z.object({}),
    response: z.object({
      totalFetched: z.number(),
      totalResults: z.number(),
    }),
    async handler(ctx, _args) {
      requireAuth(ctx);
      let totalFetched = 0;
      let page = 1;
      let totalResults = 0;
      let lastPage = 1;

      do {
        const response = await fetchCarnivalPage(page);
        totalResults = response.results.totalResults;
        lastPage = response.results.lastPage;
        totalFetched += await storeCruises(ctx, response);
        page++;
        
        if (page > 5) break; // Limit to 5 pages for safety
      } while (page <= lastPage);

      
      return { totalFetched, totalResults };
    },
  }),

  listCruises: defineAction({
    request: z.object({
      cabinFilter: z.enum(["none", "balcony", "suite"]).default("none"),
      shipCode: z.string().optional(),
      departurePort: z.string().optional(),
      minDuration: z.number().int().positive().optional(),
      maxDuration: z.number().int().positive().optional(),
      sortBy: z.enum(["price", "duration"]).default("price"),
      sortDir: z.enum(["asc", "desc"]).default("asc"),
      limit: z.number().int().positive().max(100).default(50),
      offset: z.number().int().nonnegative().default(0),
    }),
    response: z.object({
      cruises: z.array(z.object({
        id: z.number(),
        sailingId: z.string(),
        shipName: z.string(),
        shipCode: z.string(),
        departurePort: z.string(),
        itineraryTitle: z.string(),
        durationDays: z.number(),
        departureDate: z.string(),
        arrivalDate: z.string(),
        interiorPrice: z.number().nullable(),
        interiorSoldOut: z.boolean(),
        balconyPrice: z.number().nullable(),
        balconySoldOut: z.boolean(),
        suitePrice: z.number().nullable(),
        suiteSoldOut: z.boolean(),
        rateCode: z.string().nullable(),
        bookingUrl: z.string(),
        ports: z.string(),
        favorited: z.boolean(),
      })),
      total: z.number(),
    }),
    async handler(ctx, args) {
      requireAuth(ctx);
      const db = ctx.db<typeof schema>();
      
      const conditions = [];
      if (args.cabinFilter === "balcony") {
        conditions.push(eq(schema.cruises.balconySoldOut, false));
      } else if (args.cabinFilter === "suite") {
        conditions.push(eq(schema.cruises.suiteSoldOut, false));
      }
      if (args.shipCode) {
        conditions.push(eq(schema.cruises.shipCode, args.shipCode));
      }
      if (args.departurePort) {
        conditions.push(eq(schema.cruises.departurePort, args.departurePort));
      }
      if (args.minDuration !== undefined) {
        conditions.push(sql`${schema.cruises.durationDays} >= ${args.minDuration}`);
      }
      if (args.maxDuration !== undefined) {
        conditions.push(sql`${schema.cruises.durationDays} <= ${args.maxDuration}`);
      }
      
      const whereClause = conditions.length > 0 ? and(...conditions) : undefined;
      
      let orderBy;
      if (args.sortBy === "duration") {
        orderBy = args.sortDir === "asc"
          ? sql`${schema.cruises.durationDays} ASC`
          : sql`${schema.cruises.durationDays} DESC`;
      } else {
        if (args.cabinFilter === "none") {
          orderBy = args.sortDir === "asc"
            ? sql`${schema.cruises.interiorPrice} IS NULL, ${schema.cruises.interiorPrice} ASC`
            : sql`${schema.cruises.interiorPrice} IS NULL, ${schema.cruises.interiorPrice} DESC`;
        } else if (args.cabinFilter === "balcony") {
          orderBy = args.sortDir === "asc"
            ? sql`${schema.cruises.balconyPrice} IS NULL, ${schema.cruises.balconyPrice} ASC`
            : sql`${schema.cruises.balconyPrice} IS NULL, ${schema.cruises.balconyPrice} DESC`;
        } else {
          orderBy = args.sortDir === "asc"
            ? sql`${schema.cruises.suitePrice} IS NULL, ${schema.cruises.suitePrice} ASC`
            : sql`${schema.cruises.suitePrice} IS NULL, ${schema.cruises.suitePrice} DESC`;
        }
      }

      const rows = await db
        .select()
        .from(schema.cruises)
        .where(whereClause)
        .orderBy(orderBy)
        .limit(args.limit)
        .offset(args.offset);

      const totalResult = await db
        .select({ count: sql<number>`count(*)` })
        .from(schema.cruises)
        .where(whereClause);

      return {
        cruises: rows.map(r => ({
          id: r.id,
          sailingId: r.sailingId,
          shipName: r.shipName,
          shipCode: r.shipCode,
          departurePort: r.departurePort,
          itineraryTitle: r.itineraryTitle,
          durationDays: r.durationDays,
          departureDate: r.departureDate,
          arrivalDate: r.arrivalDate,
          interiorPrice: r.interiorPrice,
          interiorSoldOut: r.interiorSoldOut,
          balconyPrice: r.balconyPrice,
          balconySoldOut: r.balconySoldOut,
          suitePrice: r.suitePrice,
          suiteSoldOut: r.suiteSoldOut,
          rateCode: r.rateCode,
          bookingUrl: r.bookingUrl,
          ports: r.ports,
          favorited: r.favorited,
        })),
        total: totalResult[0]?.count ?? 0,
      };
    },
  }),

  toggleFavorite: defineAction({
    request: z.object({ sailingId: z.string() }),
    response: z.object({ favorited: z.boolean() }),
    async handler(ctx, args) {
      requireAuth(ctx);
      const db = ctx.db<typeof schema>();
      const rows = await db
        .select({ favorited: schema.cruises.favorited })
        .from(schema.cruises)
        .where(eq(schema.cruises.sailingId, args.sailingId))
        .limit(1);
      
      if (rows.length === 0) {
        throw new Error("Cruise not found");
      }

      const newFavorited = !(rows[0]?.favorited ?? false);
      await db
        .update(schema.cruises)
        .set({ favorited: newFavorited })
        .where(eq(schema.cruises.sailingId, args.sailingId));

      
      return { favorited: newFavorited };
    },
  }),

  getMetadata: defineAction({
    request: z.object({}),
    response: z.object({
      lastRefresh: z.string().nullable(),
      totalResults: z.number(),
      ships: z.array(z.object({ code: z.string(), name: z.string() })),
      departurePorts: z.array(z.string()),
    }),
    async handler(ctx, _args) {
      requireAuth(ctx);
      const db = ctx.db<typeof schema>();
      const meta = await db.select().from(schema.searchMetadata).limit(1);
      const ships = await db
        .select({ code: schema.cruises.shipCode, name: schema.cruises.shipName })
        .from(schema.cruises)
        .groupBy(schema.cruises.shipCode, schema.cruises.shipName)
        .orderBy(schema.cruises.shipName);
      const ports = await db
        .select({ port: schema.cruises.departurePort })
        .from(schema.cruises)
        .groupBy(schema.cruises.departurePort)
        .orderBy(schema.cruises.departurePort);

      return {
        lastRefresh: meta[0]?.lastRefresh ?? null,
        totalResults: meta[0]?.totalResults ?? 0,
        ships: ships.map((s: { code: string; name: string }) => ({ code: s.code, name: s.name })),
        departurePorts: ports.map((p: { port: string }) => p.port),
      };
    },
  }),

  getFlightOptions: defineAction({
    request: z.object({
      departurePort: z.string(),
      departureDate: z.string(),
      arrivalDate: z.string(),
    }),
    response: z.object({
      origin: z.string(),
      destinationAirport: z.string(),
      airportOptions: z.array(z.string()),
      outboundDate: z.string(),
      returnDate: z.string(),
      outboundFlights: z.array(z.object({
        flightNumbers: z.array(z.string()),
        cabinOptions: z.array(z.string()),
        departTime: z.string(),
        arriveTime: z.string(),
        duration: z.string(),
        stops: z.number(),
        priceMain: z.number(),
        priceFirst: z.number(),
        bookingUrl: z.string(),
      })),
      returnFlights: z.array(z.object({
        flightNumbers: z.array(z.string()),
        cabinOptions: z.array(z.string()),
        departTime: z.string(),
        arriveTime: z.string(),
        duration: z.string(),
        stops: z.number(),
        priceMain: z.number(),
        priceFirst: z.number(),
        bookingUrl: z.string(),
      })),
      bufferHoursOutbound: z.number(),
      bufferHoursReturn: z.number(),
    }),
    async handler(_ctx, args) {
      requireAuth(_ctx);
      const origin = "GEG";
      const airports = PORT_TO_AIRPORTS[args.departurePort] ?? ["LAX"];
      const destinationAirport = airports[0] ?? "LAX";
      
      const depDate = parseDateSafe(args.departureDate);
      const arrDate = parseDateSafe(args.arrivalDate);
      
      const outboundDateObj = addDays(depDate, -1);
      const returnDateObj = addDays(arrDate, 1);
      
      const outboundDate = formatDateYYYYMMDD(outboundDateObj);
      const returnDate = formatDateYYYYMMDD(returnDateObj);
      
      const outboundFlights = generateFlights(origin, destinationAirport, outboundDate, "outbound");
      const returnFlights = generateFlights(destinationAirport, origin, returnDate, "return");
      
      const bufferHoursOutbound = 24;
      const bufferHoursReturn = 24;
      
      return {
        origin,
        destinationAirport,
        airportOptions: airports,
        outboundDate,
        returnDate,
        outboundFlights,
        returnFlights,
        bufferHoursOutbound,
        bufferHoursReturn,
      };
    },
  }),
} satisfies ActionsModule;