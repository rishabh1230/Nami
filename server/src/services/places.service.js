import axios from "axios";
import {
  GOOGLE_PLACES_BASE_URL,
  PLACE_DETAILS_FIELDS
} from "../constants.js";

const API_KEY = process.env.PLACES_API_KEY;

if (!API_KEY) {
  console.error("❌ PLACES_API_KEY missing");
  process.exit(1);
}

/* ---------- Text Search ---------- */
export const searchPlaceByName = async (name, coordinates = null) => {
  const params = { query: name, key: API_KEY };

  if (coordinates) {
    params.location = `${coordinates.lat},${coordinates.lng}`;
    params.radius = 1000;
  }

  const res = await axios.get(
    "https://maps.googleapis.com/maps/api/place/textsearch/json",
    { params, timeout: 8000 }
  );

  if (res.data.status !== "OK" || !res.data.results?.length) {
    throw new Error(`No place found for "${name}"`);
  }

  return res.data.results[0].place_id;
};

/* ---------- Place Details ---------- */
export const getPlaceDetails = async (placeId) => {
  const res = await axios.get(
    `${GOOGLE_PLACES_BASE_URL}/details/json`,
    {
      timeout: 8000,
      params: {
        place_id: placeId,
        fields: PLACE_DETAILS_FIELDS,
        key: API_KEY
      }
    }
  );

  if (res.data.status !== "OK") {
    throw new Error("Place details failed");
  }

  return res.data.result;
};

/* ---------- Nearby Search (TYPE ONLY) ---------- */
export const findNearbyPlacesByTypeAtLocation = async ({
  lat,
  lng,
  type,
  radius = 5000,
  maxResults = 10
}) => {
  if (
    typeof lat !== "number" ||
    typeof lng !== "number" ||
    !type ||
    !Number.isFinite(radius)
  ) {
    console.warn("⚠️ Skipping nearby search (invalid params)", {
      lat,
      lng,
      type,
      radius
    });
    return [];
  }

  try {
    const res = await axios.get(
      `${GOOGLE_PLACES_BASE_URL}/nearbysearch/json`,
      {
        timeout: 8000,
        params: {
          location: `${lat},${lng}`,
          radius,
          type,
          key: API_KEY
        }
      }
    );

    if (
      res.data.status !== "OK" &&
      res.data.status !== "ZERO_RESULTS"
    ) {
      console.warn("⚠️ Nearby search status:", res.data.status);
      return [];
    }

    return (res.data.results || [])
      .slice(0, maxResults)
      .map(p => ({
        place_id: p.place_id,
        name: p.name,
        coordinates: {
          lat: p.geometry.location.lat,
          lng: p.geometry.location.lng
        }
      }));
  } catch (err) {
    console.warn("⚠️ Nearby search failed:", err.message);
    return [];
  }
};
