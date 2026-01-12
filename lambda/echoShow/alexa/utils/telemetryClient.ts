
const TELEMETRY_API = process.env.TELEMETRY_API ?? "";
const AUTH_HEADER = process.env.TELEMETRY_AUTH_HEADER ?? "";

export interface TelemetryData {
  temperature: number | null;
  humidity: number | null;
  parkingSlots: ParkingSlot[];
}

export interface ParkingSlot {
  slot: number;
  status: "empty" | "occupied" | "unknown";
  distance_cm?: number;
  datetime: string;
}

/**
 * Fetch complete telemetry summary (temperature, humidity, parking)
 */
export async function fetchTelemetrySummary(timeoutMs: number = 5000): Promise<TelemetryData> {
  try {
    if (!TELEMETRY_API || !AUTH_HEADER) {
      throw new Error("Telemetry API is not configured.");
    }
    console.log("🌡️ Fetching telemetry data...");
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    const response = await fetch(`${TELEMETRY_API}/summary`, {
      method: "GET",
      headers: {
        Authorization: AUTH_HEADER,
        "Content-Type": "application/json",
      },
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`Telemetry API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    console.log("Telemetry data received:", JSON.stringify(data, null, 2));

    return {
      temperature: data.ht?.temperature ?? data.temperature ?? null,
      humidity: data.ht?.humidity ?? data.humidity ?? null,
      parkingSlots: data.parking?.slots ?? data.parking_slots ?? [],
    };
  } catch (error: any) {
    if (error.name === "AbortError") {
      console.error(" Telemetry API timeout after", timeoutMs, "ms");
    } else {
      console.error(" Telemetry API error:", error.message);
    }
    
    // Return empty data structure (caller handles fallback)
    return {
      temperature: null,
      humidity: null,
      parkingSlots: [],
    };
  }
}

/**
 * Fetch only temperature & humidity
 */
export async function fetchTemperatureHumidity(): Promise<{ temperature: number | null; humidity: number | null }> {
  try {
    if (!TELEMETRY_API || !AUTH_HEADER) {
      throw new Error("Telemetry API is not configured.");
    }
    const response = await fetch(`${TELEMETRY_API}/ht/latest`, {
      headers: { Authorization: AUTH_HEADER },
      signal: AbortSignal.timeout(5000),
    });

    if (!response.ok) {
      throw new Error(`HT API error: ${response.status}`);
    }

    const data = await response.json();
    return {
      temperature: data.temperature ?? null,
      humidity: data.humidity ?? null,
    };
  } catch (error) {
    console.error(" Temperature/Humidity fetch error:", error);
    return { temperature: null, humidity: null };
  }
}

/**
 * Fetch only parking data
 */
export async function fetchParkingStatus(): Promise<ParkingSlot[]> {
  try {
    if (!TELEMETRY_API || !AUTH_HEADER) {
      throw new Error("Telemetry API is not configured.");
    }
    const response = await fetch(`${TELEMETRY_API}/parking/latest`, {
      headers: { Authorization: AUTH_HEADER },
      signal: AbortSignal.timeout(5000),
    });

    if (!response.ok) {
      throw new Error(`Parking API error: ${response.status}`);
    }

    const data = await response.json();
    return data.slots ?? data ?? [];
  } catch (error) {
    console.error("Parking fetch error:", error);
    return [];
  }
}

/**
 * Calculate parking statistics
 */
export function calculateParkingStats(slots: ParkingSlot[]) {
  const total = slots.length;
  const occupied = slots.filter((s) => s.status === "occupied").length;
  const available = total - occupied;
  const occupancyRate = total > 0 ? Math.round((occupied / total) * 100) : 0;

  return {
    total,
    occupied,
    available,
    occupancyRate,
  };
}
