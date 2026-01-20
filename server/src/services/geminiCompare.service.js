import { GoogleGenAI } from "@google/genai";

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_MODEL =
  process.env.GEMINI_MODEL || "gemini-1.5-flash";

if (!GEMINI_API_KEY) {
  throw new Error("GEMINI_API_KEY missing");
}

const genAI = new GoogleGenAI({ apiKey: GEMINI_API_KEY });

/* ----------------------------------------------------
   Score normalizers
---------------------------------------------------- */
const normalizeDistanceScore = (km) => {
  if (!Number.isFinite(km)) return 0;
  if (km <= 1) return 10;
  if (km >= 10) return 0;
  return Math.round((10 - km) * 10) / 10;
};

const normalizeDensityScore = (count) => {
  if (!Number.isFinite(count)) return 0;
  if (count >= 20) return 10;
  return Math.round((count / 20) * 10 * 10) / 10;
};

/* ----------------------------------------------------
   SAFE Gemini text extraction
---------------------------------------------------- */
const extractGeminiText = (result) => {
  const text =
    result?.candidates?.[0]?.content?.parts
      ?.map(p => p.text)
      ?.join("")
      ?.trim();

  if (!text) {
    throw new Error("Gemini returned no text");
  }

  return text;
};

/* ----------------------------------------------------
   Gemini review-based comparison
---------------------------------------------------- */
const getGeminiReviewComparison = async (
  source,
  candidate
) => {
  const prompt = `
Compare two places using ONLY user reviews.

SOURCE REVIEWS:
${JSON.stringify(source.reviews || [], null, 2)}

CANDIDATE REVIEWS:
${JSON.stringify(candidate.reviews || [], null, 2)}

Return ONLY valid JSON:
{
  "gemini_similarity": number,
  "reasoning": string,
  "pros": string[],
  "cons": string[]
}
`;

  const result = await genAI.models.generateContent({
    model: GEMINI_MODEL,
    contents: [{ role: "user", parts: [{ text: prompt }] }]
  });

  const rawText = extractGeminiText(result);

  // Remove accidental markdown fences
  const cleaned = rawText
    .replace(/```json/gi, "")
    .replace(/```/g, "")
    .trim();

  return JSON.parse(cleaned);
};

/* ----------------------------------------------------
   PUBLIC FUNCTION
---------------------------------------------------- */
export const comparePlacesWithGemini = async ({
  sourcePlace,
  candidatePlace,
  distanceFromCurrentCityKm,
  nearbyPlacesCount
}) => {
  try {
    const ai = await getGeminiReviewComparison(
      sourcePlace,
      candidatePlace
    );

    const finalScore =
      0.7 * ai.gemini_similarity +
      0.2 * normalizeDistanceScore(distanceFromCurrentCityKm) +
      0.1 * normalizeDensityScore(nearbyPlacesCount);

    return {
      similarity_score:
        Math.round(finalScore * 10) / 10,
      gemini_similarity: ai.gemini_similarity,
      distance_score:
        normalizeDistanceScore(distanceFromCurrentCityKm),
      density_score:
        normalizeDensityScore(nearbyPlacesCount),
      reasoning: ai.reasoning,
      pros: ai.pros,
      cons: ai.cons,
      provider: "gemini"
    };
  } catch (err) {
    console.error("❌ GEMINI ERROR:", err.message);

    return {
      similarity_score: 0,
      gemini_similarity: 0,
      distance_score: 0,
      density_score: 0,
      reasoning: "AI comparison unavailable",
      pros: [],
      cons: [],
      provider: "gemini"
    };
  }
};
