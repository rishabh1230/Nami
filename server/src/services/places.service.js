import axios from "axios";
import {
  GOOGLE_PLACES_BASE_URL,
  PLACE_DETAILS_FIELDS
} from "../constants.js";

console.log("ENV CHECK:", {
  PLACES_API_KEY: !!process.env.PLACES_API_KEY,
  GEMINI_API_KEY: !!process.env.GEMINI_API_KEY
});
const API_KEY = process.env.PLACES_API_KEY;

if (!API_KEY) {
  console.error("❌ PLACES_API_KEY missing from .env!");
  process.exit(1);
}

/* ------------------------------------------------------------------ */
/* 🔍 Resolve place by NAME + optional location bias (UNCHANGED LOGIC) */
/* ------------------------------------------------------------------ */

export const searchPlaceByName = async (name, coordinates = null) => {
  const params = {
    query: name,
    key: API_KEY
  };

  if (coordinates) {
    params.location = `${coordinates.lat},${coordinates.lng}`;
    params.radius = 1000;
  }

  const response = await axios.get(
    "https://maps.googleapis.com/maps/api/place/textsearch/json",
    { params }
  );

  if (response.data.status !== "OK" || !response.data.results?.length) {
    throw new Error(`No place found for "${name}"`);
  }

  return response.data.results[0].place_id;
};

/* ------------------------------------------------------------------ */
/* 📋 Get FULL place details (UNCHANGED, LEGACY SAFE)                  */
/* ------------------------------------------------------------------ */

export const getPlaceDetails = async (placeId) => {
  const response = await axios.get(
    `${GOOGLE_PLACES_BASE_URL}/details/json`,
    {
      params: {
        place_id: placeId,
        fields: PLACE_DETAILS_FIELDS,
        key: API_KEY
      }
    }
  );

  if (response.data.status !== "OK") {
    console.error("❌ Place Details API ERROR:", response.data);
    throw new Error(
      `Place details failed: ${response.data.status} - ${
        response.data.error_message || "No message"
      }`
    );
  }

  return response.data.result;
};

/* ------------------------------------------------------------------ */
/* 🧭 NEW: Find nearby places of SAME TYPE around a CITY LOCATION      */
/* ------------------------------------------------------------------ */
/* Used for: recommending similar places near CURRENT CITY            */
/* ------------------------------------------------------------------ */

export const findNearbyPlacesByTypeAtLocation = async ({
  lat,
  lng,
  type,
  radius = 10000,   // 10 km default
  maxResults = 15
}) => {
  const response = await axios.get(
    `${GOOGLE_PLACES_BASE_URL}/nearbysearch/json`,
    {
      params: {
        location: `${lat},${lng}`,
        radius,
        type,
        key: API_KEY
      },
      timeout: 15000
    }
  );

  if (response.data.status !== "OK") {
    throw new Error(
      `Nearby search failed: ${response.data.status}`
    );
  }

  return (response.data.results || [])
    .slice(0, maxResults)
    .map(place => ({
      place_id: place.place_id,
      name: place.name,
      rating: place.rating || 0,
      user_ratings_total: place.user_ratings_total || 0,
      coordinates: {
        lat: place.geometry.location.lat,
        lng: place.geometry.location.lng
      }
    }));
};
