import axios from "axios";

const API_KEY = process.env.GOOGLE_MAPS_API_KEY;

/* Haversine fallback (km) */
const haversineDistance = (o, d) => {
  const toRad = v => (v * Math.PI) / 180;
  const R = 6371;

  const dLat = toRad(d.lat - o.lat);
  const dLng = toRad(d.lng - o.lng);

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(o.lat)) *
      Math.cos(toRad(d.lat)) *
      Math.sin(dLng / 2) ** 2;

  return Math.round(R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)) * 100) / 100;
};

export const getDrivingDistanceWithTraffic = async ({ origin, destination }) => {
  try {
    if (!API_KEY) throw new Error("Missing API key");

    const res = await axios.get(
      "https://maps.googleapis.com/maps/api/distancematrix/json",
      {
        timeout: 8000,
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

    const el = res?.data?.rows?.[0]?.elements?.[0];

    if (res.data.status !== "OK" || !el || el.status !== "OK") {
      throw new Error("Invalid Distance Matrix response");
    }

    return {
      distance_km: el.distance.value / 1000,
      duration_text: el.duration.text,
      duration_in_traffic_text: el.duration_in_traffic?.text || null
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
