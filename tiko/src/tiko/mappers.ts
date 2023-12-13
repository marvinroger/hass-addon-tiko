import { Result, err, ok } from "neverthrow";
import { GetDataResponse } from "./query-responses.js";
import { PresetMode } from "../hass.js";

type TikoPresetMode = {
  absence: boolean;
  boost: boolean;
  disableHeating: boolean;
  frost: boolean;
};

export function mapPresetMode(
  mode: TikoPresetMode
): Result<PresetMode | undefined, Error> {
  const onModes = Object.entries(mode)
    .filter(([, on]) => on)
    .map(([key]) => key);

  if (onModes.length > 1) {
    return err(
      new Error(
        `Multiple modes are on, which should not be possible: ${onModes.join(
          ", "
        )}`
      )
    );
  }

  if (mode.absence) {
    return ok("away");
  }

  if (mode.boost) {
    return ok("boost");
  }

  if (mode.disableHeating) {
    return ok("off");
  }

  if (mode.frost) {
    return ok("frostprotection");
  }

  return ok("none");
}

export function serializePresetMode(mode: PresetMode): TikoPresetMode {
  switch (mode) {
    case "away":
      return {
        absence: true,
        boost: false,
        disableHeating: false,
        frost: false,
      };
    case "boost":
      return {
        absence: false,
        boost: true,
        disableHeating: false,
        frost: false,
      };
    case "off":
      return {
        absence: false,
        boost: false,
        disableHeating: true,
        frost: false,
      };
    case "frostprotection":
      return {
        absence: false,
        boost: false,
        disableHeating: false,
        frost: true,
      };
    case "none":
      return {
        absence: false,
        boost: false,
        disableHeating: false,
        frost: false,
      };
  }
}

type Room = {
  id: number;
  name: string;
  /** tiko sometimes returns 0 when their system is unavailable, so we normalize to `undefined` to avoid statistics issues */
  energyKwh: number | undefined;
  currentTemperature: number;
  currentHumidity: number;
  targetTemperature: number;
  presetMode: PresetMode | undefined;
  heating: boolean;
};

export type Property = {
  id: number;
  name: string;
  rooms: Room[];
};

export type Properties = Property[];

export function mapProperties(
  getDataResponse: GetDataResponse
): Result<Properties, Error> {
  const properties: Properties = [];

  for (const property of getDataResponse.properties) {
    const rooms: Room[] = [];

    for (const room of property.rooms) {
      const presetModeResult = mapPresetMode(room.mode);

      if (presetModeResult.isErr()) {
        return err(presetModeResult.error);
      }

      const presetMode = presetModeResult.value;

      const relevantConsumption =
        property.fastConsumption.roomsConsumption.find(
          (roomConsumption) => roomConsumption.id === room.id
        );

      if (!relevantConsumption) {
        return err(new Error(`Unable to find consumption for room ${room.id}`));
      }

      rooms.push({
        id: room.id,
        name: room.name,
        energyKwh:
          relevantConsumption.energyKwh !== 0
            ? relevantConsumption.energyKwh
            : undefined,
        currentTemperature: room.currentTemperatureDegrees,
        currentHumidity: room.humidity,
        targetTemperature: room.targetTemperatureDegrees,
        presetMode,
        heating: room.status.heatingOperating,
      });
    }

    properties.push({
      id: property.id,
      name: property.name,
      rooms,
    });
  }

  return ok(properties);
}
