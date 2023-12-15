import { z } from "zod";

export const PROVIDER_SCHEMA = z.enum(["tiko", "mon-pilotage-elec"]);

export type Provider = z.infer<typeof PROVIDER_SCHEMA>;

export const DOMAIN_PER_PROVIDER: Record<Provider, string> = {
  tiko: "particuliers-tiko.fr",
  "mon-pilotage-elec": "portal-engie.tiko.ch",
};
