import { siteConfig } from "./metadata";

/** Public contact details for the exhibition and print enquiries. */
export const siteContact = {
  name: siteConfig.artist,
  email: "john@margies.app",
  phoneDisplay: "0422 139 337",
  phoneTel: "+61422139337",
  location: siteConfig.exhibition.location,
} as const;
