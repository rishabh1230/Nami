import { GoogleGenAI } from "@google/genai";

/* =====================================================
   ENV & CLIENT
===================================================== */
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_MODEL =
  process.env.GEMINI_MODEL || "gemini-1.5-flash";

if (!GEMINI_API_KEY) {
  throw new Error("GEMINI_API_KEY missing");
}

const genAI = new GoogleGenAI({
  apiKey: GEMINI_API_KEY
});

/* =====================================================
   SCORE NORMALIZERS
===================================================== */
const normalizeDistanceScore = (distanceKm) => {
  if (typeof distanceKm !== "number") return 0;
  if (distanceKm <= 1) return 10;
  if (distanceKm >= 10) return 0;
  return Math.round((10 - distanceKm) * 10) / 10;
};

const normalizeDensityScore = (nearbyCount) => {
  if (typeof nearbyCount !== "number") return 0;
  if (nearbyCount >= 20) return 10;
  return Math.round((nearbyCount / 20) * 10 * 10) / 10;
};

/* =====================================================
   INTERNAL: GEMINI REVIEW COMPARISON
===================================================== */
const getGeminiReviewComparison = async (
  source,
  candidate
) => {
  const prompt = `
You are an expert location analyst.

Compare two real-world places of the SAME category using ONLY user reviews.
Be factual, balanced, and concise.
Do NOT invent information.
If reviews conflict, explicitly mention it.

SOURCE PLACE REVIEWS:
${JSON.stringify(source?.reviews || [], null, 2)}

CANDIDATE PLACE REVIEWS:
${JSON.stringify(candidate?.reviews || [], null, 2)}

Return ONLY valid JSON in EXACT format:
{
  "gemini_similarity": number,
  "reasoning": string,
  "pros": string[],
  "cons": string[]
}

Rules:
- gemini_similarity must be between 0 and 10
- Base everything strictly on reviews
- No markdown
- No extra text
`;

  const response = await genAI.models.generateContent({
    model: GEMINI_MODEL,
    contents: prompt
  });

  const text = response.text;

  try {
    return JSON.parse(text);
  } catch {
    throw new Error("Gemini returned invalid JSON");
  }
};

/* =====================================================
   PUBLIC FUNCTION (USE THIS)
===================================================== */
export const comparePlacesWithGemini = async ({
  sourcePlace,
  candidatePlace,
  distanceFromCurrentCityKm,
  nearbyPlacesCount
}) => {
  try {
    const aiResult =
      await getGeminiReviewComparison(
        sourcePlace,
        candidatePlace
      );

    const distanceScore =
      normalizeDistanceScore(
        distanceFromCurrentCityKm
      );

    const densityScore =
      normalizeDensityScore(
        nearbyPlacesCount
      );

    const finalScore =
      0.7 * aiResult.gemini_similarity +
      0.2 * distanceScore +
      0.1 * densityScore;

    return {
      similarity_score:
        Math.round(finalScore * 10) / 10,
      gemini_similarity:
        aiResult.gemini_similarity,
      distance_score: distanceScore,
      density_score: densityScore,
      reasoning: aiResult.reasoning,
      pros: aiResult.pros,
      cons: aiResult.cons,
      provider: "gemini"
    };

  } catch (err) {
    console.error(
      "❌ GEMINI SERVICE ERROR:",
      err.message
    );

    return {
      similarity_score: 0,
      gemini_similarity: 0,
      distance_score: 0,
      density_score: 0,
      reasoning:
        "AI-based comparison unavailable",
      pros: [],
      cons: [],
      provider: "gemini"
    };
  }
};
