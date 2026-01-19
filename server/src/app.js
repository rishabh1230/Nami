import express from "express";
import cors from "cors";

import recommendRoutes from "./routes/recommend.routes.js";

const app = express();

app.use(cors());
app.use(express.json());

app.use("/api/recommend", recommendRoutes);

app.use((err, req, res, next) => {
  console.error("❌ ERROR:", err.message);
  res.status(500).json({ message: err.message });
});

export default app;
