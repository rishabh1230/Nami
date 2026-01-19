import express from "express";
import { recommendPlaces } from
  "../controllers/recommend.controller.js";

const router = express.Router();

router.post("/", recommendPlaces);

export default router;
