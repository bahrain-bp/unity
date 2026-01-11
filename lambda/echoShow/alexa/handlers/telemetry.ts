// lambda/echoShow/alexa/handlers/telemetry.ts

import { telemetryCardDocument } from "../apl/telemetry-card";
import {
  fetchTelemetrySummary,
  fetchTemperatureHumidity,
  fetchParkingStatus,
  calculateParkingStats,
} from "../utils/telemetryClient";

export async function getTemperature(event: any) {
  try {
    const { temperature } = await fetchTemperatureHumidity();
    const hasTemperature = temperature !== null;
    const temp = hasTemperature ? `${temperature}C` : "Sensor offline";

    return {
      version: "1.0",
      response: {
        shouldEndSession: false,
        outputSpeech: {
          type: "PlainText",
          text: temperature !== null
            ? `The current temperature is ${temperature} degrees celsius.`
            : "Sorry, temperature data is currently unavailable.",
        },
        directives: [
          {
            type: "Alexa.Presentation.APL.RenderDocument",
            token: "temperature",
            document: telemetryCardDocument,
            datasources: {
              data: {
                title: "Temperature",
                description: "Current office temperature",
                value: temp,
                accentColor: hasTemperature ? "#EF4444" : "#6B7280",
              },
            },
          },
        ],
      },
    };
  } catch (error) {
    console.error("Temperature handler error:", error);
    return buildErrorResponse("Sorry, I couldn't fetch the temperature right now.");
  }
}

export async function getHumidity(event: any) {
  try {
    const { humidity } = await fetchTemperatureHumidity();
    const hasHumidity = humidity !== null;
    const humidityText = hasHumidity ? `${humidity}%` : "Sensor offline";

    return {
      version: "1.0",
      response: {
        shouldEndSession: false,
        outputSpeech: {
          type: "PlainText",
          text: humidity !== null
            ? `The current humidity is ${humidity} percent.`
            : "Sorry, humidity data is currently unavailable.",
        },
        directives: [
          {
            type: "Alexa.Presentation.APL.RenderDocument",
            token: "humidity",
            document: telemetryCardDocument,
            datasources: {
              data: {
                title: "Humidity",
                description: "Current humidity level",
                value: humidityText,
                accentColor: hasHumidity ? "#3B82F6" : "#6B7280",
              },
            },
          },
        ],
      },
    };
  } catch (error) {
    console.error("Humidity handler error:", error);
    return buildErrorResponse("Sorry, I couldn't fetch the humidity right now.");
  }
}

export async function getParkingStatus(event: any) {
  try {
    const slots = await fetchParkingStatus();
    const stats = calculateParkingStats(slots);

    return {
      version: "1.0",
      response: {
        shouldEndSession: false,
        outputSpeech: {
          type: "PlainText",
          text: stats.total > 0
            ? `${stats.available} out of ${stats.total} parking slots are available.`
            : "Parking data is currently unavailable.",
        },
        directives: [
          {
            type: "Alexa.Presentation.APL.RenderDocument",
            token: "parking",
            document: telemetryCardDocument,
            datasources: {
              data: {
                title: "Parking",
                description: "Available spaces right now",
                value: stats.total > 0 ? `${stats.available} / ${stats.total}` : "N/A",
                accentColor: "#10B981", // Green
              },
            },
          },
        ],
      },
    };
  } catch (error) {
    console.error("Parking handler error:", error);
    return buildErrorResponse("Sorry, I couldn't fetch parking status right now.");
  }
}

export async function getClimate(event: any) {
  try {
    const { temperature, humidity } = await fetchTemperatureHumidity();
    const hasTemperature = temperature !== null;
    const hasHumidity = humidity !== null;
    const temp = hasTemperature ? `${temperature}C` : "Sensor offline";
    const hum = hasHumidity ? `${humidity}%` : "Sensor offline";

    const speechText =
      hasTemperature && hasHumidity
        ? `The temperature is ${temperature} degrees celsius and humidity is ${humidity} percent.`
        : "Climate data is unavailable right now.";

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
            token: "climate",
            document: telemetryCardDocument,
            datasources: {
              data: {
                title: "Climate",
                description: "Temperature & Humidity",
                value: hasTemperature && hasHumidity ? `${temp} / ${hum}` : "Sensor offline",
                accentColor: hasTemperature && hasHumidity ? "#8B5CF6" : "#6B7280",
              },
            },
          },
        ],
      },
    };
  } catch (error) {
    console.error("Climate handler error:", error);
    return buildErrorResponse("Sorry, I couldn't fetch climate data right now.");
  }
}

function buildErrorResponse(message: string) {
  return {
    version: "1.0",
    response: {
      shouldEndSession: false,
      outputSpeech: {
        type: "PlainText",
        text: message,
      },
    },
  };
}
