import axios from "axios";

const API_KEY = process.env.GOOGLE_MAPS_API_KEY;

if (!API_KEY) {
  console.error("❌ GOOGLE_MAPS_API_KEY missing from .env!");
  process.exit(1);
}

/**
 * 🚗 Driving distance with traffic (Google Distance Matrix)
 */
export const getDrivingDistanceMatrix = async ({
  origin,
  destination
}) => {
  try {
    const response = await axios.get(
      "https://maps.googleapis.com/maps/api/distancematrix/json",
      {
        params: {
          origins: `${origin.lat},${origin.lng}`,
          destinations: `${destination.lat},${destination.lng}`,
          mode: "driving",
          departure_time: "now",
          traffic_model: "best_guess",
          key: API_KEY
        }
      }
    );

    const element =
      response.data.rows?.[0]?.elements?.[0];

    if (!element || element.status !== "OK") {
      throw new Error("Distance Matrix returned no result");
    }

    return {
      distance_km: Number(
        (element.distance.value / 1000).toFixed(2)
      ),
      duration_text: element.duration.text,
      duration_in_traffic_text:
        element.duration_in_traffic?.text ||
        element.duration.text
    };
  } catch (error) {
    console.error("❌ Distance Matrix ERROR:", error.message);
    throw error;
  }
};
