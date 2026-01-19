import { SUPPORTED_PLACE_TYPES } from "../constants.js";
import { resolveSourcePlace } from "../services/recommendation.service.js";
import { getDrivingDistanceWithTraffic } from "../services/distanceMatrix.service.js";
import {
  findNearbyPlacesByTypeAtLocation,
  getPlaceDetails
} from "../services/places.service.js";
import { normalizePlaceProfile } from "../utils/normalizer.js";
import { comparePlacesWithGemini } from "../services/geminiCompare.service.js";

/* ----------------------------------------------------
   Helper: normalize Google place type
---------------------------------------------------- */
const normalizePlaceType = (type) => {
  if (!type) return null;
  return type.toLowerCase().replace(/\s+/g, "_");
};

export const recommendPlaces = async (req, res) => {
  try {
    const { previous_city, current_city, source_places } = req.body;

    /* ---------------- VALIDATION ---------------- */

    if (
      !previous_city?.coordinates?.lat ||
      !previous_city?.coordinates?.lng ||
      !current_city?.coordinates?.lat ||
      !current_city?.coordinates?.lng ||
      !Array.isArray(source_places)
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid input structure"
      });
    }

    const results = [];

    /* ---------------- PROCESS SOURCE PLACES ---------------- */

    for (const place of source_places) {
      const rawType = place.type;
      const type = normalizePlaceType(rawType);

      if (
        !place.name ||
        !type ||
        !SUPPORTED_PLACE_TYPES.includes(type) ||
        typeof place.coordinates?.lat !== "number" ||
        typeof place.coordinates?.lng !== "number"
      ) {
        console.warn("⚠️ Skipping invalid source place:", place);
        continue;
      }

      /* ========== 1️⃣ Resolve SOURCE place ========== */

      const resolvedSource = await resolveSourcePlace({
        name: place.name,
        type,
        coordinates: place.coordinates
      });

      const sourceDriving = await getDrivingDistanceWithTraffic({
        origin: previous_city.coordinates,
        destination: resolvedSource.coordinates
      });

      const sourceDistanceKm =
        sourceDriving.distance_meters / 1000;

      /* ========== 2️⃣ Find CANDIDATES near CURRENT city ========== */

      const searchRadius =
        Math.max(sourceDistanceKm * 1000 + 2000, 3000);

      const candidates = await findNearbyPlacesByTypeAtLocation({
        lat: current_city.coordinates.lat,
        lng: current_city.coordinates.lng,
        type,
        radius: searchRadius,
        maxResults: 10
      });

      const recommendedPlaces = [];

      for (const candidate of candidates) {
        try {
          const driving = await getDrivingDistanceWithTraffic({
            origin: current_city.coordinates,
            destination: candidate.coordinates
          });

          const candidateKm =
            driving.distance_meters / 1000;

          const lower = Math.max(sourceDistanceKm - 1, 1);
          const upper = sourceDistanceKm + 1;

          if (candidateKm < lower || candidateKm > upper) continue;

          const details = await getPlaceDetails(candidate.place_id);
          const normalizedCandidate =
            normalizePlaceProfile(details, type);

          let similarity;
          try {
            similarity = await comparePlacesWithGemini({
              sourcePlace: resolvedSource,
              candidatePlace: normalizedCandidate,
              distanceFromCurrentCityKm: candidateKm,
              nearbyPlacesCount: candidates.length
            });
          } catch {
            similarity = {
              similarity_score: null,
              reasoning: "AI comparison unavailable",
              pros: [],
              cons: []
            };
          }

          recommendedPlaces.push({
            ...normalizedCandidate,
            driving_distance_from_current_city_km: Number(candidateKm.toFixed(2)),
            driving_duration: driving.duration_text,
            driving_duration_in_traffic: driving.duration_in_traffic_text,
            similarity
          });
        } catch (err) {
          console.error("Candidate failed:", err.message);
        }
      }

      results.push({
        source_place: {
          ...resolvedSource,
          distance_from_previous_city_km: Number(sourceDistanceKm.toFixed(2))
        },
        recommended_places_near_current_city: recommendedPlaces
      });
    }

    return res.json({
      success: true,
      previous_city,
      current_city,
      results
    });

  } catch (err) {
    console.error("❌ recommendPlaces ERROR:", err);
    return res.status(500).json({
      success: false,
      message: "Internal server error"
    });
  }
};
