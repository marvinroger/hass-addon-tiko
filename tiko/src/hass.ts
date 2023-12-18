import { z } from "zod";
import { Property } from "./tiko/mappers.js";
import { Result, err, ok } from "neverthrow";

type CommandTopic = { topic: string; type: "climate"; roomId: number };
export type MqttMessage = { topic: string; retain: boolean; message: string };

export type HassMqttConfiguration = {
  commandTopics: Record<string, CommandTopic>;
  messages: MqttMessage[];
};

export function computeHassMqttConfiguration(
  property: Property
): HassMqttConfiguration {
  const commandTopics: Record<string, CommandTopic> = {};
  const messages: MqttMessage[] = [];

  for (const room of property.rooms) {
    const fqid = `${HASS_ID_PREFIX}${room.id}`;

    const climateEntityTopic = `${HASS_MQTT_DISCOVERY_PREFIX}/climate/${fqid}`;
    const climateStateTopic = `${climateEntityTopic}/state`;
    const climateCommandTopic = `${climateEntityTopic}/set`;

    const energyEntityTopic = `${HASS_MQTT_DISCOVERY_PREFIX}/sensor/${fqid}`;
    const energyStateTopic = `${energyEntityTopic}/state`;

    const temperatureEntityId = `${fqid}_temperature`;
    const temperatureEntityTopic = `${HASS_MQTT_DISCOVERY_PREFIX}/sensor/${temperatureEntityId}`;
    const temperatureStateTopic = `${temperatureEntityTopic}/state`;

    const humidityEntityId = `${fqid}_humidity`;
    const humidityEntityTopic = `${HASS_MQTT_DISCOVERY_PREFIX}/sensor/${humidityEntityId}`;
    const humidityStateTopic = `${humidityEntityTopic}/state`;

    const device = {
      manufacturer: "tiko",
      identifiers: [fqid],
      name: `${room.name} heating`,
      suggested_area: room.name,
    };

    commandTopics[climateCommandTopic] = {
      topic: climateCommandTopic,
      type: "climate",
      roomId: room.id,
    };

    messages.push(
      { topic: GLOBAL_AVAILABILITY_TOPIC, retain: true, message: "online" },
      {
        topic: `${climateEntityTopic}/config`,
        retain: false,
        message: JSON.stringify({
          unique_id: fqid,
          name: null,
          device,

          temperature_unit: "C",
          min_temp: 7,
          max_temp: 25,
          temp_step: 0.5,
          preset_modes: PRESET_MODES_WITHOUT_NONE,
          modes: ["heat", "off"],

          availability: [GLOBAL_AVAILABILITY_CONFIG],

          mode_state_topic: climateStateTopic,
          mode_state_template: "{{ value_json.mode }}",
          current_humidity_topic: climateStateTopic,
          current_humidity_template: "{{ value_json.current_humidity }}",
          current_temperature_topic: climateStateTopic,
          current_temperature_template: "{{ value_json.current_temperature }}",
          temperature_state_topic: climateStateTopic,
          temperature_state_template: "{{ value_json.target_temperature }}",
          preset_mode_state_topic: climateStateTopic,
          preset_mode_value_template: "{{ value_json.preset_mode }}",

          temperature_command_topic: climateCommandTopic,
          temperature_command_template:
            '{{ {"type": "targetTemperature", "targetTemperature": value} | tojson }}',
          preset_mode_command_topic: climateCommandTopic,
          preset_mode_command_template:
            '{{ {"type": "presetMode", "presetMode": value} | tojson }}',
        }),
      },
      {
        topic: climateStateTopic,
        retain: true,
        message: JSON.stringify({
          mode: room.heating ? "heat" : "off",
          current_humidity: room.currentHumidity,
          current_temperature: room.currentTemperature,
          target_temperature: room.targetTemperature,
          preset_mode: room.presetMode,
        }),
      },
      {
        topic: `${energyEntityTopic}/config`,
        retain: false,
        message: JSON.stringify({
          unique_id: fqid,
          name: "Consumption",
          device,

          device_class: "energy",
          state_class: "total_increasing",
          unit_of_measurement: "kWh",

          availability: [GLOBAL_AVAILABILITY_CONFIG],

          state_topic: energyStateTopic,
          value_template: "{{ value_json.energy }}",
        }),
      },
      {
        topic: `${temperatureEntityTopic}/config`,
        retain: false,
        message: JSON.stringify({
          unique_id: temperatureEntityId,
          name: "Temperature",
          device,

          device_class: "temperature",
          state_class: "measurement",
          unit_of_measurement: "°C",

          availability: [GLOBAL_AVAILABILITY_CONFIG],

          state_topic: temperatureStateTopic,
          value_template: "{{ value_json.temperature }}",
        }),
      },
      {
        topic: temperatureStateTopic,
        retain: true,
        message: JSON.stringify({
          temperature: room.currentTemperature,
        }),
      }
    );

    if (room.currentHumidity != undefined) {
      messages.push(
        {
          topic: `${humidityEntityTopic}/config`,
          retain: false,
          message: JSON.stringify({
            unique_id: humidityEntityId,
            name: "Humidity",
            device,

            device_class: "humidity",
            state_class: "measurement",
            unit_of_measurement: "%",

            availability: [GLOBAL_AVAILABILITY_CONFIG],

            state_topic: humidityStateTopic,
            value_template: "{{ value_json.humidity }}",
          }),
        },
        {
          topic: humidityStateTopic,
          retain: true,
          message: JSON.stringify({
            humidity: room.currentHumidity,
          }),
        }
      );
    }

    if (room.energyKwh != undefined) {
      messages.push({
        topic: energyStateTopic,
        retain: true,
        message: JSON.stringify({
          energy: room.energyKwh,
        }),
      });
    }
  }

  return { commandTopics, messages };
}

export const HASS_ID_PREFIX = "tiko_";
export const HASS_MQTT_DISCOVERY_PREFIX = "homeassistant";
export const HASS_MQTT_BIRTH_TOPIC = `${HASS_MQTT_DISCOVERY_PREFIX}/status`;
export const GLOBAL_AVAILABILITY_TOPIC = `${HASS_MQTT_DISCOVERY_PREFIX}/tiko/availability`;
const GLOBAL_AVAILABILITY_CONFIG = { topic: GLOBAL_AVAILABILITY_TOPIC };

// `none` is a special case in Home Assistant and must not be advertised
const PRESET_MODES_WITHOUT_NONE = [
  "off",
  "away",
  "boost",
  "frostprotection",
] as const;

const PRESET_MODES = ["none", ...PRESET_MODES_WITHOUT_NONE] as const;
export type PresetMode = (typeof PRESET_MODES)[number];
const PRESET_MODE_SCHEMA = z.enum(PRESET_MODES);
export const CLIMATE_COMMAND_SCHEMA = z.union([
  z.object({
    type: z.literal("targetTemperature"),
    targetTemperature: z.number(),
  }),
  z.object({
    type: z.literal("presetMode"),
    presetMode: PRESET_MODE_SCHEMA,
  }),
]);
export const MQTT_CLIMATE_COMMAND_TOPIC_REGEX = new RegExp(
  `^${HASS_MQTT_DISCOVERY_PREFIX}\\/climate\\/(?<hassId>${HASS_ID_PREFIX}\\d+)\\/set$`
);

const INTEGER_REGEX = /^\d+$/;

export function mapHassIdToTikoId(id: string): Result<number, Error> {
  if (!id.startsWith(HASS_ID_PREFIX)) {
    return err(new Error(`Invalid HASS ID: ${id}`));
  }

  const tikoId = id.substring(HASS_ID_PREFIX.length);

  if (!INTEGER_REGEX.test(tikoId)) {
    return err(new Error(`Invalid HASS ID: ${id}`));
  }

  return ok(parseInt(tikoId));
}
