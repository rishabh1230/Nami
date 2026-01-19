import OpenAI from "openai";

/* =====================================================
   ENV
===================================================== */
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const OPENAI_MODEL = process.env.OPENAI_MODEL || "gpt-4o-mini";

if (!OPENAI_API_KEY) {
  throw new Error("OPENAI_API_KEY missing");
}

const openai = new OpenAI({ apiKey: OPENAI_API_KEY });

/* =====================================================
   SCORE NORMALIZERS
===================================================== */
const normalizeDistanceScore = (distanceKm) => {
  if (distanceKm <= 1) return 10;
  if (distanceKm >= 10) return 0;
  return Math.round((10 - distanceKm) * 10) / 10;
};

const normalizeDensityScore = (nearbyCount) => {
  if (nearbyCount >= 20) return 10;
  return Math.round((nearbyCount / 20) * 10 * 10) / 10;
};

/* =====================================================
   OPENAI REVIEW-BASED COMPARISON
===================================================== */
const getOpenAIReviewComparison = async (source, candidate) => {
  const systemPrompt = `
You are an expert location analyst.

You compare two real-world places of the SAME category using only user reviews.
You must be factual, balanced, and concise.
Never invent information.
If reviews conflict, explicitly mention it.
Return ONLY valid JSON.
`;

  const userPrompt = `
SOURCE PLACE REVIEWS:
${JSON.stringify(source.reviews, null, 2)}

CANDIDATE PLACE REVIEWS:
${JSON.stringify(candidate.reviews, null, 2)}

Return JSON in EXACT format:
{
  "gemini_similarity": number,
  "reasoning": string,
  "pros": string[],
  "cons": string[]
}

Rules:
- gemini_similarity must be between 0 and 10
- Base reasoning ONLY on reviews
- No markdown
- No extra keys
`;

  const response = await openai.chat.completions.create({
    model: OPENAI_MODEL,
    temperature: 0.4,
    max_tokens: 400,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt }
    ]
  });

  const content = response.choices?.[0]?.message?.content;

  if (!content) {
    throw new Error("OpenAI returned empty response");
  }

  return JSON.parse(content);
};

/* =====================================================
   FINAL PUBLIC FUNCTION (NAME UNCHANGED)
===================================================== */
export const comparePlacesWithGemini = async ({
  sourcePlace,
  candidatePlace,
  distanceFromCurrentCityKm,
  nearbyPlacesCount
}) => {
  try {
    // 1️⃣ Review-based similarity (OpenAI)
    const aiResult = await getOpenAIReviewComparison(
      sourcePlace,
      candidatePlace
    );

    // 2️⃣ Distance & density normalization
    const distanceScore = normalizeDistanceScore(
      distanceFromCurrentCityKm
    );

    const densityScore = normalizeDensityScore(
      nearbyPlacesCount
    );

    // 3️⃣ Weighted final score
    const finalScore =
      0.7 * aiResult.gemini_similarity +
      0.2 * distanceScore +
      0.1 * densityScore;

    return {
      similarity_score: Math.round(finalScore * 10) / 10,
      gemini_similarity: aiResult.gemini_similarity,
      distance_score: distanceScore,
      density_score: densityScore,
      reasoning: aiResult.reasoning,
      pros: aiResult.pros,
      cons: aiResult.cons
    };

  } catch (err) {
    console.error("❌ OPENAI COMPARISON ERROR:", err.message);

    return {
      similarity_score: 0,
      gemini_similarity: 0,
      distance_score: 0,
      density_score: 0,
      reasoning: "AI-based comparison unavailable",
      pros: [],
      cons: []
    };
  }
};
