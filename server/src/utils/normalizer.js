export const normalizePlaceProfile = (details, type) => {
  return {
    type,
    name: details.name,
    rating: details.rating || 0,
    reviews_count: details.user_ratings_total || 0,

    reviews: (details.reviews || []).map(r => ({
      author: r.author_name,
      rating: r.rating,
      text: r.text
    })),

    address: details.formatted_address,

    coordinates: {
      lat: details.geometry.location.lat,
      lng: details.geometry.location.lng
    },

    opening_hours: details.opening_hours?.weekday_text || [],

    services: {
  opening_hours_available: Boolean(details.opening_hours),
  price_level: details.price_level ?? null
    },

    business_status: details.business_status,
    types: details.types
  };
};
