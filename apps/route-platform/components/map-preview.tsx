"use client";
// The former CSS "Pilotkarte" has been replaced by a real interactive
// OpenStreetMap (see live-map.tsx). This thin re-export keeps the existing
// call sites (admin, live, planung) working under the old name.
export { LiveMap as MapPreview } from "./live-map";
