import { SUPPORTED_PLACE_TYPES } from "../constants.js";
import { resolveSourcePlace } from "../services/recommendation.service.js";
import { getDrivingDistanceWithTraffic } from "../services/distanceMatrix.service.js";
import {
  findNearbyPlacesByTypeAtLocation,
  getPlaceDetails
} from "../services/places.service.js";
import { normalizePlaceProfile } from "../utils/normalizer.js";
import { comparePlacesWithGemini } from "../services/geminiCompare.service.js";

const normalizeType = (t) =>
  t?.toLowerCase().replace(/\s+/g, "_");

export const recommendPlaces = async (req, res) => {
  try {
    const { previous_city, current_city, source_places } = req.body;

    if (!Array.isArray(source_places)) {
      return res.status(400).json({ success: false });
    }

    const results = [];

    for (const place of source_places) {
      const type = normalizeType(place.type);

      if (!SUPPORTED_PLACE_TYPES.includes(type)) continue;

      const source = await resolveSourcePlace({
        name: place.name,
        type,
        coordinates: place.coordinates
      });

      const srcDist = await getDrivingDistanceWithTraffic({
        origin: previous_city.coordinates,
        destination: source.coordinates
      });

      const sourceDistanceKm =
        typeof srcDist.distance_km === "number"
          ? srcDist.distance_km
          : 3;

      const searchRadius = Math.max(
        sourceDistanceKm * 1000 + 2000,
        3000
      );

      const candidates =
        await findNearbyPlacesByTypeAtLocation({
          lat: current_city.coordinates.lat,
          lng: current_city.coordinates.lng,
          type,
          radius: searchRadius
        });

      const recommended = [];

      for (const c of candidates) {
        const d = await getDrivingDistanceWithTraffic({
          origin: current_city.coordinates,
          destination: c.coordinates
        });

        if (!Number.isFinite(d.distance_km)) continue;

        const details = await getPlaceDetails(c.place_id);
        const normalized = normalizePlaceProfile(details, type);

        const similarity = await comparePlacesWithGemini({
          sourcePlace: source,
          candidatePlace: normalized,
          distanceFromCurrentCityKm: d.distance_km,
          nearbyPlacesCount: candidates.length
        });

        recommended.push({
          ...normalized,
          driving_distance_from_current_city_km: d.distance_km,
          similarity
        });
      }

      results.push({
        source_place: {
          ...source,
          distance_from_previous_city_km: sourceDistanceKm
        },
        recommended_places_near_current_city: recommended
      });
    }

    res.json({ success: true, results });
  } catch (err) {
    console.error("❌ recommendPlaces ERROR:", err.message);
    res.status(500).json({ success: false });
  }
};
