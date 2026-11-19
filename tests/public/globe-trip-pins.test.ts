import { test } from "node:test";
import assert from "node:assert/strict";
import { globeTripPins } from "../../src/lib/public-trips/globe-pins";
const p = (slug: string, latitude: number) => ({
  place: {
    id: slug,
    slug,
    name: slug,
    country: "India",
    region: null,
    description: null,
    coverImage: null,
    latitude,
    longitude: 79,
  },
});
const trip = {
  id: "t1",
  slug: "my-trip",
  title: "My trip",
  destination: "Uttarakhand",
  coverImage: null,
  routeData: { publication: { tripLocation: { latitude: 30, longitude: 78 } } },
  tripPlaces: [
    p("my-trip-trip-location", 30),
    p("my-trip-temple", 30.48),
    p("my-trip-lake", 30.5),
  ],
};
test("globe uses exactly one chosen trip location, not individual visited place pins", () => {
  const pins = globeTripPins([trip]);
  assert.equal(pins.length, 1);
  assert.equal(pins[0].latitude, 30);
  assert.equal(pins[0].longitude, 78);
  assert.equal(pins[0].tripPlaces[0].trip.slug, "my-trip");
});
test("legacy main trip pin is supported; arbitrary photo places never become globe pins", () => {
  assert.equal(globeTripPins([{ ...trip, routeData: {} }]).length, 1);
  assert.equal(
    globeTripPins([
      { ...trip, routeData: {}, tripPlaces: [p("temple", 30.48)] },
    ]).length,
    0,
  );
});
