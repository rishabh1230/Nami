import axios from "axios";

const API_KEY = process.env.GOOGLE_MAPS_API_KEY;

/**
 * 🌍 Haversine distance fallback (km)
 */
const haversineDistance = (origin, destination) => {
  const toRad = (v) => (v * Math.PI) / 180;
  const R = 6371;

  const dLat = toRad(destination.lat - origin.lat);
  const dLng = toRad(destination.lng - origin.lng);

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(origin.lat)) *
      Math.cos(toRad(destination.lat)) *
      Math.sin(dLng / 2) ** 2;

  return Math.round(R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)) * 100) / 100;
};

/**
 * 🚗 Get driving distance + duration (traffic-aware)
 * NEVER throws in production
 */
export const getDrivingDistanceWithTraffic = async ({
  origin,
  destination
}) => {
  if (!API_KEY) {
    console.warn("⚠️ GOOGLE_MAPS_API_KEY missing, using fallback");
    return {
      distance_km: haversineDistance(origin, destination),
      duration_text: null,
      duration_in_traffic_text: null
    };
  }

  try {
    const response = await axios.get(
      "https://maps.googleapis.com/maps/api/distancematrix/json",
      {
        timeout: 8000, // 🔥 critical for Render
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

    const element = response?.data?.rows?.[0]?.elements?.[0];

    if (
      response.data.status !== "OK" ||
      !element ||
      element.status !== "OK"
    ) {
      throw new Error("Invalid Distance Matrix response");
    }

    return {
      distance_km: element.distance.value / 1000,
      duration_text: element.duration.text,
      duration_in_traffic_text:
        element.duration_in_traffic?.text || null
    };

  } catch (err) {
    console.warn(
      "⚠️ Distance Matrix failed, using haversine fallback:",
      err.message
    );

    return {
      distance_km: haversineDistance(origin, destination),
      duration_text: null,
      duration_in_traffic_text: null
    };
  }
};
