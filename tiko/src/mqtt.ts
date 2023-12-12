import mqtt from "mqtt";
import { Result, fromPromise } from "neverthrow";
import { MqttConfig } from "./config.js";

type MqttClientParams = {
  config: MqttConfig;
  will: { topic: string; retain: boolean; message: string };
  onConnect: () => void;
  onClose: () => void;
  onError: (err: Error) => void;
  onMessage: (topic: string, message: Buffer) => void;
};

export class MqttClient {
  private readonly mqttClient: mqtt.MqttClient;

  constructor({
    config,
    will,
    onConnect,
    onClose,
    onError,
    onMessage,
  }: MqttClientParams) {
    this.mqttClient = mqtt
      .connect(config.brokerUrl, {
        will: {
          topic: will.topic,
          retain: will.retain,
          payload: Buffer.from(will.message),
        },
        ...(config.username ? { username: config.username } : {}),
        ...(config.password ? { password: config.password } : {}),
      })
      .on("connect", onConnect)
      .on("close", onClose)
      .on("error", onError)
      .on("message", onMessage);
  }

  async publish(
    topic: string,
    retain: boolean,
    message: string
  ): Promise<Result<void, Error>> {
    return fromPromise(
      this.mqttClient.publishAsync(topic, message, { retain }),
      (err) => new Error("Unable to publish", { cause: err })
    ).map(() => undefined);
  }

  async subscribe(topic: string): Promise<Result<void, Error>> {
    return fromPromise(
      this.mqttClient.subscribeAsync(topic),
      (err) => new Error("Unable to subscribe", { cause: err })
    ).map(() => undefined);
  }

  reconnect(): void {
    this.mqttClient.reconnect();
  }
}
