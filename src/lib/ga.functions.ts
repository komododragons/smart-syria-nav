import { createServerFn } from "@tanstack/react-start";

// GA4 measurement IDs are public identifiers; exposing them to the browser is safe.
export const getGaMeasurementId = createServerFn({ method: "GET" }).handler(async () => {
  const id = (process.env["GOOGLE_ANALYTICS_MEASUREMENT_ID"] ?? "").trim();
  return /^G-[A-Z0-9]+$/i.test(id) ? id : null;
});
