import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

/* ---------- ABSOLUTE .env LOADING ---------- */
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");

dotenv.config({
  path: path.join(rootDir, ".env")
});

/* ---------- VERIFY ---------- */
console.log("ENV CHECK:", {
  PLACES_API_KEY: !!process.env.PLACES_API_KEY,
  GEMINI_API_KEY: !!process.env.GEMINI_API_KEY
});

/* ---------- IMPORTS THAT DEPEND ON ENV ---------- */
const { default: app } = await import("./app.js");
const { PORT } = await import("./constants.js");

app.listen(PORT, () => {
  console.log(`✅ Server running on port ${PORT}`);
});
