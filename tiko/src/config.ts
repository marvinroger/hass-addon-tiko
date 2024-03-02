import { ok, err, Result } from "neverthrow";
import { PROVIDER_SCHEMA, Provider } from "./tiko/providers.js";
import { validate } from "./lib/validation.js";

export type TikoConfig = {
  provider: Provider;
  email: string;
  password: string;
  propertyId: number | undefined;
  bypassSchedule: boolean;
};

export type MqttConfig = {
  brokerUrl: string;
  username: string | undefined;
  password: string | undefined;
};

type Configuration = {
  updateIntervalMinutes: number;
  tiko: TikoConfig;
  mqtt: MqttConfig;
};

export function loadConfiguration(): Result<Configuration, Error> {
  if (!process.env["TIKO_PROVIDER"]) {
    return err(new Error("TIKO_PROVIDER is missing"));
  }

  const tikoProviderResult = validate(
    PROVIDER_SCHEMA,
    process.env["TIKO_PROVIDER"]
  );

  if (tikoProviderResult.isErr()) {
    return err(tikoProviderResult.error);
  }

  const tikoProvider = tikoProviderResult.value;

  if (!process.env["TIKO_EMAIL"]) {
    return err(new Error("TIKO_EMAIL is missing"));
  }

  if (!process.env["TIKO_PASSWORD"]) {
    return err(new Error("TIKO_PASSWORD is missing"));
  }

  if (!process.env["MQTT_BROKER_URL"]) {
    return err(new Error("MQTT_BROKER_URL is missing"));
  }

  if (!process.env["UPDATE_INTERVAL_MINUTES"]) {
    return err(new Error("UPDATE_INTERVAL_MINUTES is missing"));
  }

  const updateIntervalMinutesResult = parsePositiveInteger(
    process.env["UPDATE_INTERVAL_MINUTES"]
  );

  if (updateIntervalMinutesResult.isErr()) {
    return err(updateIntervalMinutesResult.error);
  }

  const updateIntervalMinutes = updateIntervalMinutesResult.value;

  const tikoBypassScheduleResult = parseBoolean(
    process.env["TIKO_BYPASS_SCHEDULE"]
  );

  if (tikoBypassScheduleResult.isErr()) {
    return err(tikoBypassScheduleResult.error);
  }

  let tikoPropertyId: number | undefined = undefined;
  if (process.env["TIKO_PROPERTY_ID"]) {
    const tikoPropertyIdResult = parsePositiveInteger(
      process.env["TIKO_PROPERTY_ID"]
    );

    if (tikoPropertyIdResult.isErr()) {
      return err(tikoPropertyIdResult.error);
    }

    tikoPropertyId = tikoPropertyIdResult.value;
  }

  return ok({
    updateIntervalMinutes,
    tiko: {
      provider: tikoProvider,
      email: process.env["TIKO_EMAIL"],
      password: process.env["TIKO_PASSWORD"],
      propertyId: tikoPropertyId,
      bypassSchedule: tikoBypassScheduleResult.value ?? false,
    },
    mqtt: {
      brokerUrl: process.env["MQTT_BROKER_URL"],
      username: process.env["MQTT_USERNAME"],
      password: process.env["MQTT_PASSWORD"],
    },
  });
}

function parsePositiveInteger(value: string): Result<number, Error> {
  const parsed = parseInt(value, 10);

  if (!Number.isInteger(parsed) || parsed <= 0) {
    return err(new Error(`${value} is not a positive number`));
  }

  return ok(parsed);
}

function parseBoolean(
  value: string | undefined
): Result<boolean | undefined, Error> {
  if (value === undefined) {
    return ok(undefined);
  }

  if (value === "true") {
    return ok(true);
  }

  if (value === "false") {
    return ok(false);
  }

  return err(new Error(`${value} is not a boolean`));
}
