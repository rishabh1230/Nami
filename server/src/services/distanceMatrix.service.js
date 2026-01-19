import axios from "axios";

const API_KEY = process.env.PLACES_API_KEY;

/**
 * 🚗 Get driving distance + duration (traffic-aware)
 */
export const getDrivingDistanceWithTraffic = async ({
  origin,
  destination
}) => {
  const params = {
    origins: `${origin.lat},${origin.lng}`,
    destinations: `${destination.lat},${destination.lng}`,
    mode: "driving",
    departure_time: "now", // 🔥 enables traffic
    traffic_model: "best_guess",
    key: API_KEY
  };

  const response = await axios.get(
    "https://maps.googleapis.com/maps/api/distancematrix/json",
    { params }
  );

  if (
    response.data.status !== "OK" ||
    response.data.rows[0].elements[0].status !== "OK"
  ) {
    throw new Error("Distance Matrix request failed");
  }

  const element = response.data.rows[0].elements[0];

  return {
    distance_meters: element.distance.value,
    distance_text: element.distance.text,
    duration_seconds: element.duration.value,
    duration_text: element.duration.text,
    duration_in_traffic_seconds:
      element.duration_in_traffic?.value || null,
    duration_in_traffic_text:
      element.duration_in_traffic?.text || null
  };
};
