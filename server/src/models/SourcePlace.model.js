import mongoose from "mongoose";

const SourcePlaceSchema = new mongoose.Schema(
  {
    type: String,
    name: String,
    rating: Number,
    review_count: Number,
    price_level: Number,
    distance: Number,
    coordinates: Object,
    service_tags: [String],
    review_summary: String
  },
  { timestamps: true }
);

export default mongoose.model(
  "SourcePlace",
  SourcePlaceSchema
);
