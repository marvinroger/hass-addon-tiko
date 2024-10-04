import { type } from "arktype";

export const PROVIDER_SCHEMA = type("===", "tiko", "mon-pilotage-elec");

export type Provider = typeof PROVIDER_SCHEMA.infer;

export const DOMAIN_PER_PROVIDER: Record<Provider, string> = {
  tiko: "particuliers-tiko.fr",
  "mon-pilotage-elec": "portal-engie.tiko.ch",
};
