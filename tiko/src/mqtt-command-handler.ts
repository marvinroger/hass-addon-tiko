import {
  CLIMATE_COMMAND_SCHEMA,
  HASS_MQTT_BIRTH_TOPIC,
  MQTT_CLIMATE_COMMAND_TOPIC_REGEX,
  mapHassIdToTikoId,
} from "./hass.js";
import { logger } from "./logger.js";
import { StateUpdater } from "./state-updater.js";
import { TikoClient } from "./tiko/client.js";

export class MqttCommandHandler {
  constructor(
    private readonly stateUpdater: StateUpdater,
    private readonly tikoClient: TikoClient,
    private readonly propertyId: number
  ) {}

  async handleMessage(topic: string, message: string) {
    if (topic === HASS_MQTT_BIRTH_TOPIC && message === "online") {
      logger.info("Received Home Assistant online message, refreshing");
      this.stateUpdater.requestUpdate();
      return;
    }

    const commandMatch = MQTT_CLIMATE_COMMAND_TOPIC_REGEX.exec(topic);
    if (commandMatch) {
      const { hassId } = commandMatch.groups ?? {};

      if (!hassId) {
        logger.warn(
          { topic, message },
          "Invalid MQTT command, unable to find HASS ID"
        );
        return;
      }

      const tikoIdResult = mapHassIdToTikoId(hassId);

      if (tikoIdResult.isErr()) {
        logger.warn(
          { topic, message, error: tikoIdResult.error },
          "Invalid MQTT command, unable to map HASS ID to tiko ID"
        );
        return;
      }

      const tikoId = tikoIdResult.value;

      const commandResult = CLIMATE_COMMAND_SCHEMA.safeParse(
        JSON.parse(message)
      );

      if (!commandResult.success) {
        logger.warn(
          { topic, message, errors: commandResult.error },
          "Invalid MQTT command, unable to parse message"
        );
        return;
      }

      const { data } = commandResult;

      if (data.type === "targetTemperature") {
        const payload = {
          propertyId: this.propertyId,
          roomId: tikoId,
          targetTemperature: data.targetTemperature,
        };

        logger.info(payload, "Setting room target temperature");

        const result = await this.tikoClient.setRoomTargetTemperature(payload);

        if (result.isErr()) {
          logger.error(result.error, "Failed to set target temperature");
          return;
        }

        return this.stateUpdater.requestUpdate();
      }

      if (data.type === "presetMode") {
        if (data.presetMode === "off") {
          logger.warn(
            "Setting individual preset mode 'off' is not supported by tiko, ignoring"
          );
          return;
        }

        const payload = {
          propertyId: this.propertyId,
          roomId: tikoId,
          mode: data.presetMode,
        };

        logger.info(payload, "Setting room mode");

        const result = await this.tikoClient.setRoomMode(payload);

        if (result.isErr()) {
          logger.error(result.error, "Failed to set room mode");
          return;
        }

        return this.stateUpdater.requestUpdate();
      }

      return;
    }

    logger.warn({ topic, message }, "Unknown MQTT message");
  }
}
