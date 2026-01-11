// lambda/echoShow/alexa/handlers/iotSensors.ts

import { iotSensorsDashboardDocument } from "../apl/iot-sensors-dashboard-apl-document";
import { fetchTelemetrySummary, calculateParkingStats } from "../utils/telemetryClient";

export async function showIotSensors(event: any) {
  try {
    console.log("Fetching IoT dashboard data...");

    const { temperature, humidity, parkingSlots } = await fetchTelemetrySummary();
    const parkingStats = calculateParkingStats(parkingSlots);

    // Format for APL display
    const formattedSlots = parkingSlots.map((slot, index) => {
      const status = slot.status ?? "unknown";
      const statusColor =
        status === "occupied" ? "#EF4444" : status === "empty" ? "#10B981" : "#9CA3AF";

      return {
        slotNumber: slot.slot ?? index + 1,
        status,
        statusColor,
      };
    });

    // Build speech
    const speechParts = [];
    if (temperature !== null) {
      speechParts.push(`Temperature is ${temperature} degrees celsius`);
    }
    if (humidity !== null) {
      speechParts.push(`humidity is ${humidity} percent`);
    }
    if (parkingStats.total > 0) {
      speechParts.push(`${parkingStats.available} of ${parkingStats.total} parking slots are available`);
    }

    const speechText =
      speechParts.length > 0
        ? speechParts.join(", ") + "."
        : "IoT sensor data is currently unavailable.";

    console.log("IoT dashboard data prepared");

    return {
      version: "1.0",
      response: {
        shouldEndSession: false,
        outputSpeech: {
          type: "PlainText",
          text: speechText,
        },
        directives: [
          {
            type: "Alexa.Presentation.APL.RenderDocument",
            token: "iotSensors",
            document: iotSensorsDashboardDocument,
            datasources: {
              data: {
                temperature: temperature ?? 0,
                humidity: humidity ?? 0,
                totalSlots: parkingStats.total,
                occupiedSlots: parkingStats.occupied,
                availableSlots: parkingStats.available,
                slots: formattedSlots,
                hasSlots: parkingStats.total > 0,
              },
            },
          },
        ],
      },
    };
  } catch (error) {
    console.error("IoT sensors handler error:", error);
    return buildFallbackResponse();
  }
}

function buildFallbackResponse() {
  return {
    version: "1.0",
    response: {
      shouldEndSession: false,
      outputSpeech: {
        type: "PlainText",
        text: "Sorry, I couldn't fetch the sensor data right now. Showing demo data.",
      },
      directives: [
        {
          type: "Alexa.Presentation.APL.RenderDocument",
          token: "iotSensors",
          document: iotSensorsDashboardDocument,
          datasources: {
            data: {
              temperature: 25,
              humidity: 48,
              totalSlots: 4,
              occupiedSlots: 1,
              availableSlots: 3,
              hasSlots: true,
              slots: [
                { slotNumber: 1, status: "empty", statusColor: "#10B981" },
                { slotNumber: 2, status: "occupied", statusColor: "#EF4444" },
                { slotNumber: 3, status: "empty", statusColor: "#10B981" },
                { slotNumber: 4, status: "empty", statusColor: "#10B981" },
              ],
            },
          },
        },
      ],
    },
  };
}
