import { SUPPORTED_PLACE_TYPES } from "../constants.js";
import { resolveSourcePlace } from "../services/recommendation.service.js";
import { getDrivingDistanceWithTraffic } from "../services/distanceMatrix.service.js";
import {
  findNearbyPlacesByTypeAtLocation,
  getPlaceDetails
} from "../services/places.service.js";
import { normalizePlaceProfile } from "../utils/normalizer.js";
import { comparePlacesWithGemini } from "../services/geminiCompare.service.js";

export const recommendPlaces = async (req, res) => {
  try {
    const { previous_city, current_city, source_places } = req.body;

    if (
      !previous_city?.coordinates ||
      !current_city?.coordinates ||
      !Array.isArray(source_places)
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid input structure"
      });
    }

    const results = [];

    for (const place of source_places) {
      const { name, type, coordinates } = place;

      if (
        !name ||
        !SUPPORTED_PLACE_TYPES.includes(type) ||
        typeof coordinates?.lat !== "number" ||
        typeof coordinates?.lng !== "number"
      ) {
        continue;
      }

      /* ========== 1️⃣ SOURCE PLACE ========== */

      const resolvedSource = await resolveSourcePlace({
        name,
        type,
        coordinates
      });

      const sourceDriving = await getDrivingDistanceWithTraffic({
        origin: previous_city.coordinates,
        destination: resolvedSource.coordinates
      });

      const sourceDistanceKm =
        sourceDriving.distance_meters / 1000;

      /* ========== 2️⃣ CANDIDATES IN CURRENT CITY ========== */

      const candidates =
        await findNearbyPlacesByTypeAtLocation({
          lat: current_city.coordinates.lat,
          lng: current_city.coordinates.lng,
          type,
          radius: Math.max(sourceDistanceKm * 1000 + 2000, 3000),
          maxResults: 8
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

          const lower = Math.max(sourceDistanceKm - 1, 1.5);
          const upper = Math.max(sourceDistanceKm + 1, 3.5);

          if (candidateKm < lower || candidateKm > upper) continue;

          const details = await getPlaceDetails(candidate.place_id);
          const normalizedCandidate =
            normalizePlaceProfile(details, type);

          let similarity;
          try {
            similarity = await comparePlacesWithGemini({
              sourcePlace: resolvedSource,
              candidatePlace: normalizedCandidate
            });
          } catch (aiErr) {
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
          continue;
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
