import EventEmitter from "node:events";
import { MqttMessage } from "./hass.js";
import { MqttClient } from "./mqtt.js";
import { logger } from "./logger.js";
import { TypedEmitter } from "./typed-emitter.js";

type StateManagerEvents = {
  error: (error: Error) => void;
};

export class MqttPublisher extends (EventEmitter as new () => TypedEmitter<StateManagerEvents>) {
  constructor(private readonly mqttClient: MqttClient) {
    super();
  }

  requestPublish(messages: MqttMessage[]) {
    this.publish(messages).catch((err) => {
      logger.error(err, "Unexpected error during publish");
    });
  }

  private async publish(messages: MqttMessage[]) {
    for (const message of messages) {
      const publishResult = await this.mqttClient.publish(
        message.topic,
        message.retain,
        message.message
      );

      if (publishResult.isErr()) {
        this.emit("error", publishResult.error);
      }
    }
  }
}
