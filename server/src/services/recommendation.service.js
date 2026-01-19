import {
  searchPlaceByName,
  getPlaceDetails
} from "./places.service.js";

import { normalizePlaceProfile } from "../utils/normalizer.js";

export const resolveSourcePlace = async ({ name, type, coordinates }) => {
  console.log("🔍 Resolving exact place:", name);

  const placeId = await searchPlaceByName(name, coordinates);
  const details = await getPlaceDetails(placeId);

  return normalizePlaceProfile(details, type);
};
