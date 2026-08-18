import { useCallback, useEffect, useState, type JSX } from "react";
import { api, type ApiResponse } from "./api";

type Cruise = ApiResponse<typeof api, "listCruises">["cruises"][number];
type FlightOptions = ApiResponse<typeof api, "getFlightOptions">;

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function formatPrice(price: number | null, soldOut: boolean): string {
  if (soldOut || price === null || price === 0) return "Sold Out";
  return `$${Math.round(price).toLocaleString()}`;
}

function getBalconyUpgrade(interior: number | null, balcony: number | null, soldOut: boolean): string | null {
  if (soldOut || !interior || !balcony || balcony <= 0) return null;
  const upgrade = balcony - interior;
  return `+$${Math.round(upgrade).toLocaleString()}`;
}

export function App(): JSX.Element {
  const [cruises, setCruises] = useState<Cruise[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [cabinFilter, setCabinFilter] = useState<"none" | "balcony" | "suite">("none");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [sortBy, setSortBy] = useState<"price" | "duration">("price");
  const [lastRefresh, setLastRefresh] = useState<string | null>(null);
  const [totalResults, setTotalResults] = useState(0);
  const [departurePorts, setDeparturePorts] = useState<string[]>([]);
  const [selectedPort, setSelectedPort] = useState<string>("");
  const [durationFilter, setDurationFilter] = useState<string>("all");
  const [flightLookupEnabled, setFlightLookupEnabled] = useState<boolean>(true);
  const [openFlights, setOpenFlights] = useState<Record<number, boolean>>({});
  const [flightData, setFlightData] = useState<Record<number, FlightOptions | null>>({});
  const [flightLoading, setFlightLoading] = useState<Record<number, boolean>>({});

  const loadCruises = useCallback(async () => {
    try {
      let minDuration: number | undefined;
      let maxDuration: number | undefined;
      if (durationFilter !== "all") {
        if (durationFilter === "7+") {
          minDuration = 7;
        } else {
          const days = parseInt(durationFilter, 10);
          minDuration = days;
          maxDuration = days;
        }
      }
      const result = await api.listCruises({ 
        cabinFilter, 
        sortBy,
        sortDir, 
        limit: 100, 
        offset: 0,
        departurePort: selectedPort || undefined,
        minDuration,
        maxDuration,
      });
      setCruises(result.cruises);
      setTotalResults(result.total);
    } catch (err) {
      setError(String(err));
    }
  }, [cabinFilter, sortBy, sortDir, selectedPort, durationFilter]);

  const loadMetadata = useCallback(async () => {
    try {
      const meta = await api.getMetadata({});
      setLastRefresh(meta.lastRefresh);
      setDeparturePorts(meta.departurePorts);
    } catch {}
  }, []);

  const handleRefresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      await api.refreshCruises({});
      await loadCruises();
      await loadMetadata();
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  }, [loadCruises, loadMetadata]);

  useEffect(() => {
    void loadCruises();
    void loadMetadata();
    setLoading(false);
  }, [loadCruises, loadMetadata]);

  const toggleFavorite = useCallback(async (sailingId: string) => {
    try {
      await api.toggleFavorite({ sailingId });
      void loadCruises();
    } catch (err) {
      setError(String(err));
    }
  }, [loadCruises]);

  const toggleFlights = useCallback(async (cruise: Cruise) => {
    const isOpen = openFlights[cruise.id];
    if (isOpen) {
      setOpenFlights(prev => ({ ...prev, [cruise.id]: false }));
      return;
    }
    setOpenFlights(prev => ({ ...prev, [cruise.id]: true }));
    if (!flightData[cruise.id]) {
      setFlightLoading(prev => ({ ...prev, [cruise.id]: true }));
      try {
        const data = await api.getFlightOptions({
          departurePort: cruise.departurePort,
          departureDate: cruise.departureDate,
          arrivalDate: cruise.arrivalDate,
        });
        setFlightData(prev => ({ ...prev, [cruise.id]: data }));
      } catch (err) {
        setError(String(err));
        setFlightData(prev => ({ ...prev, [cruise.id]: null }));
      } finally {
        setFlightLoading(prev => ({ ...prev, [cruise.id]: false }));
      }
    }
  }, [openFlights, flightData]);

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-[#f5f5f5]" style={{ fontFamily: "Inter, system-ui, sans-serif" }}>
      <div
        className="fixed top-0 left-0 right-0 z-40 pointer-events-none"
        style={{
          height: 'calc(var(--twsa-safe-area-inset-top) + min(2rem, var(--twsa-safe-area-inset-top)))',
          backgroundColor: '#0a0a0a',
          maskImage: 'linear-gradient(to bottom, black 0%, black 60%, transparent 100%)',
          WebkitMaskImage: 'linear-gradient(to bottom, black 0%, black 60%, transparent 100%)',
        }}
      />
      <header className="border-b border-[#2a2a2a] bg-[#1a1a1a]/80 backdrop-blur sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 py-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-[#d4af37] flex items-center justify-center">
              <span className="text-2xl">🛳️</span>
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight" style={{ fontFamily: "Playfair Display, serif" }}>
                Carnival Casino Finder
              </h1>
              <p className="text-xs text-[#888]">FSA Rate • Past Guest</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {lastRefresh && (
              <span className="text-xs text-[#666] hidden sm:block">
                Updated {new Date(lastRefresh).toLocaleTimeString()}
              </span>
            )}
            <button
              onClick={() => setFlightLookupEnabled(v => !v)}
              className={`px-3 py-2 rounded-lg text-xs font-medium transition border ${
                flightLookupEnabled
                  ? "bg-[#10b981]/20 border-[#10b981] text-[#10b981]"
                  : "bg-[#1a1a1a] border-[#2a2a2a] text-[#888]"
              }`}
              aria-pressed={flightLookupEnabled}
            >
              GEG Flights {flightLookupEnabled ? "On" : "Off"}
            </button>
            <button
              onClick={() => void handleRefresh()}
              disabled={loading}
              className="px-4 py-2 bg-[#0a4d3c] hover:bg-[#0d5f49] text-white rounded-lg text-sm font-medium transition disabled:opacity-50"
            >
              {loading ? "Refreshing..." : "Refresh"}
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-6">
        <div className="flex flex-wrap gap-2 mb-6 items-center">
          <div className="flex gap-2">
            <button
              onClick={() => setCabinFilter("none")}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
                cabinFilter === "none" ? "bg-[#3b82f6] text-white" : "bg-[#1a1a1a] text-[#ccc] hover:bg-[#2a2a2a]"
              }`}
            >
              All Cabins
            </button>
            <button
              onClick={() => setCabinFilter("balcony")}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
                cabinFilter === "balcony" ? "bg-[#10b981] text-black" : "bg-[#1a1a1a] text-[#ccc] hover:bg-[#2a2a2a]"
              }`}
            >
              Balcony Only
            </button>
            <button
              onClick={() => setCabinFilter("suite")}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
                cabinFilter === "suite" ? "bg-[#a855f7] text-black" : "bg-[#1a1a1a] text-[#ccc] hover:bg-[#2a2a2a]"
              }`}
            >
              Suite Only
            </button>
          </div>
          <div className="h-6 w-px bg-[#2a2a2a] hidden sm:block" />
          <div className="flex gap-2 items-center">
            <span className="text-xs text-[#666]">Port:</span>
            <select
              value={selectedPort}
              onChange={(e) => setSelectedPort(e.target.value)}
              className="px-3 py-2 rounded-lg text-sm bg-[#1a1a1a] text-white border border-[#2a2a2a] hover:border-[#3a3a3a] focus:outline-none focus:border-[#3b82f6] transition"
            >
              <option value="">All Ports</option>
              {departurePorts.map((port) => (
                <option key={port} value={port}>
                  {port}
                </option>
              ))}
            </select>
          </div>
          <div className="h-6 w-px bg-[#2a2a2a] hidden sm:block" />
          <div className="flex gap-2 items-center">
            <span className="text-xs text-[#666]">Duration:</span>
            <select
              value={durationFilter}
              onChange={(e) => setDurationFilter(e.target.value)}
              className="px-3 py-2 rounded-lg text-sm bg-[#1a1a1a] text-white border border-[#2a2a2a] hover:border-[#3a3a3a] focus:outline-none focus:border-[#3b82f6] transition"
            >
              <option value="all">All Lengths</option>
              <option value="3">3 days</option>
              <option value="4">4 days</option>
              <option value="5">5 days</option>
              <option value="6">6 days</option>
              <option value="7+">7+ days</option>
            </select>
          </div>
          <div className="h-6 w-px bg-[#2a2a2a] hidden sm:block" />
          <div className="flex gap-2 items-center">
            <span className="text-xs text-[#666]">Sort by:</span>
            <div className="flex bg-[#1a1a1a] rounded-lg p-0.5 border border-[#2a2a2a]">
              <button
                onClick={() => setSortBy("price")}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition ${
                  sortBy === "price" ? "bg-[#3b82f6] text-white" : "text-[#ccc] hover:text-white"
                }`}
              >
                Price
              </button>
              <button
                onClick={() => setSortBy("duration")}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition ${
                  sortBy === "duration" ? "bg-[#3b82f6] text-white" : "text-[#ccc] hover:text-white"
                }`}
              >
                Days
              </button>
            </div>
            <button
              onClick={() => setSortDir(sortDir === "asc" ? "desc" : "asc")}
              className="px-3 py-2 rounded-lg text-xs transition bg-[#2a2a2a] text-white hover:bg-[#3a3a3a]"
            >
              {sortBy === "price"
                ? (sortDir === "asc" ? "Low → High" : "High → Low")
                : (sortDir === "asc" ? "Short → Long" : "Long → Short")}
            </button>
          </div>
          <span className="ml-auto text-sm text-[#666]">{totalResults} total</span>
        </div>

        {error && (
          <div className="bg-red-900/20 border border-red-800 text-red-200 px-4 py-3 rounded-lg mb-6 text-sm">
            {error}
          </div>
        )}

        {cruises === null ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="bg-[#1a1a1a] rounded-xl p-5 animate-pulse">
                <div className="h-6 bg-[#2a2a2a] rounded w-3/4 mb-3" />
                <div className="h-4 bg-[#2a2a2a] rounded w-1/2" />
              </div>
            ))}
          </div>
        ) : cruises.length === 0 ? (
          <div className="bg-[#1a1a1a] rounded-xl p-12 text-center border border-[#2a2a2a]">
            <p className="text-[#666] mb-2">No cruises found</p>
            <p className="text-sm text-[#444]">Try adjusting filters or refresh data</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {cruises.map((cruise) => {
              const ports = JSON.parse(cruise.ports) as string[];
              const balconyUpgrade = getBalconyUpgrade(cruise.interiorPrice, cruise.balconyPrice, cruise.balconySoldOut);
              const hasBalcony = !cruise.balconySoldOut && cruise.balconyPrice && cruise.balconyPrice > 0;
              const isOpen = openFlights[cruise.id] ?? false;
              const flights = flightData[cruise.id] ?? null;
              const loadingFlights = flightLoading[cruise.id] ?? false;
              
              return (
                <div
                  key={cruise.id}
                  className="bg-[#1a1a1a] rounded-xl border border-[#2a2a2a] p-5 hover:border-[#3a3a3a] transition group"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <h3 className="font-bold text-lg leading-tight" style={{ fontFamily: "Playfair Display, serif" }}>
                        {cruise.shipName}
                      </h3>
                      <p className="text-xs text-[#888] mt-0.5">{cruise.durationDays} days • {cruise.departurePort}</p>
                    </div>
                    <button
                      onClick={() => void toggleFavorite(cruise.sailingId)}
                      className="text-xl opacity-40 hover:opacity-100 transition"
                      aria-label={cruise.favorited ? "Unfavorite" : "Favorite"}
                    >
                      {cruise.favorited ? "★" : "☆"}
                    </button>
                  </div>

                  <p className="text-sm text-[#ccc] mb-3 line-clamp-2">{cruise.itineraryTitle}</p>
                  
                  <div className="flex flex-wrap gap-1 mb-4">
                    {ports.slice(0, 3).map((port, i) => (
                      <span key={i} className="text-xs px-2 py-1 bg-[#0a0a0a] rounded text-[#888] border border-[#2a2a2a]">
                        {port}
                      </span>
                    ))}
                    {ports.length > 3 && (
                      <span className="text-xs px-2 py-1 text-[#666]">+{ports.length - 3}</span>
                    )}
                  </div>

                  <div className="space-y-2 mb-4">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-[#888]">Interior</span>
                      <span className={`font-mono ${!cruise.interiorSoldOut ? "text-white" : "text-[#666]"}`}>
                        {formatPrice(cruise.interiorPrice, cruise.interiorSoldOut)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-[#888]">Balcony</span>
                      <div className="flex items-center gap-2">
                        {balconyUpgrade && (
                          <span className="text-xs px-1.5 py-0.5 bg-[#10b981]/20 text-[#10b981] rounded font-mono">
                            {balconyUpgrade}
                          </span>
                        )}
                        <span className={`font-mono font-semibold ${hasBalcony ? "text-[#10b981]" : "text-[#666]"}`}>
                          {formatPrice(cruise.balconyPrice, cruise.balconySoldOut)}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-[#888]">Suite</span>
                      <span className={`font-mono ${!cruise.suiteSoldOut ? "text-white" : "text-[#666]"}`}>
                        {formatPrice(cruise.suitePrice, cruise.suiteSoldOut)}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-4 border-t border-[#2a2a2a]">
                    <div>
                      <p className="text-xs text-[#666]">Departs</p>
                      <p className="text-sm font-medium">{formatDate(cruise.departureDate)}</p>
                    </div>
                    <a
                      href={cruise.bookingUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-3 py-1.5 bg-[#d4af37] text-black text-xs font-semibold rounded-lg hover:bg-[#e5c35a] transition"
                    >
                      Book →
                    </a>
                  </div>

                  {flightLookupEnabled && hasBalcony && (
                    <div className="mt-4 pt-4 border-t border-[#2a2a2a]">
                      <button
                        onClick={() => void toggleFlights(cruise)}
                        className="w-full flex items-center justify-between text-xs text-[#10b981] hover:text-[#34d399] transition"
                      >
                        <span className="font-medium">Alaska flights GEG → {cruise.departurePort}</span>
                        <span>{isOpen ? "−" : "+"}</span>
                      </button>
                      {isOpen && (
                        <div className="mt-3 space-y-3">
                          {loadingFlights && (
                            <p className="text-xs text-[#666]">Loading flights...</p>
                          )}
                          {flights && (
                            <>
                              <div className="text-[10px] uppercase tracking-wide text-[#666]">
                                Closest airport: {flights.destinationAirport} {flights.airportOptions.length > 1 && `(${flights.airportOptions.join("/")})`}
                              </div>
                              <div>
                                <p className="text-[11px] text-[#888] mb-1">Outbound {formatDate(flights.outboundDate)} • {flights.bufferHoursOutbound}h buffer</p>
                                <div className="space-y-2">
                                  {flights.outboundFlights.map((f, idx) => (
                                    <div key={idx} className="bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg p-2.5">
                                      <div className="flex items-center justify-between">
                                        <span className="text-xs font-mono text-white">{f.flightNumbers.join(" → ")}</span>
                                        <span className="text-[10px] text-[#666]">{f.stops === 0 ? "Nonstop" : "1 stop"}</span>
                                      </div>
                                      <div className="flex items-center justify-between mt-1">
                                        <span className="text-xs text-[#ccc]">{f.departTime} → {f.arriveTime} • {f.duration}</span>
                                        <a href={f.bookingUrl} target="_blank" rel="noopener noreferrer" className="text-[10px] text-[#10b981] hover:underline">Book Flight</a>
                                      </div>
                                      <div className="flex gap-3 mt-1 text-[11px]">
                                        <span className="text-[#888]">Main ${Math.round(f.priceMain)}</span>
                                        <span className="text-[#d4af37]">First ${Math.round(f.priceFirst)}</span>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                              <div>
                                <p className="text-[11px] text-[#888] mb-1">Return {formatDate(flights.returnDate)} • {flights.bufferHoursReturn}h buffer</p>
                                <div className="space-y-2">
                                  {flights.returnFlights.map((f, idx) => (
                                    <div key={idx} className="bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg p-2.5">
                                      <div className="flex items-center justify-between">
                                        <span className="text-xs font-mono text-white">{f.flightNumbers.join(" → ")}</span>
                                        <span className="text-[10px] text-[#666]">{f.stops === 0 ? "Nonstop" : "1 stop"}</span>
                                      </div>
                                      <div className="flex items-center justify-between mt-1">
                                        <span className="text-xs text-[#ccc]">{f.departTime} → {f.arriveTime} • {f.duration}</span>
                                        <a href={f.bookingUrl} target="_blank" rel="noopener noreferrer" className="text-[10px] text-[#10b981] hover:underline">Book Flight</a>
                                      </div>
                                      <div className="flex gap-3 mt-1 text-[11px]">
                                        <span className="text-[#888]">Main ${Math.round(f.priceMain)}</span>
                                        <span className="text-[#d4af37]">First ${Math.round(f.priceFirst)}</span>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            </>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
