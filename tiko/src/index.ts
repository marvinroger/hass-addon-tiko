import { TikoClient } from "./tiko/client.js";
import { loadConfiguration } from "./config.js";
import { logger } from "./logger.js";
import { MqttClient } from "./mqtt.js";
import {
  GLOBAL_AVAILABILITY_TOPIC,
  HASS_MQTT_BIRTH_TOPIC,
  UNAVAILABLE_MESSAGE,
  computeHassMqttConfiguration,
} from "./hass.js";
import { StateUpdater } from "./state-updater.js";
import { MqttPublisher } from "./mqtt-publisher.js";
import { MqttCommandHandler } from "./mqtt-command-handler.js";

const configurationResult = loadConfiguration();

if (configurationResult.isErr()) {
  logger.error(configurationResult.error, "Failed to load configuration");
  process.exit(1);
}

const configuration = configurationResult.value;

const tikoClient = new TikoClient(configuration.tiko);

const initialCallResult = await tikoClient.fetchData(new Date());

if (initialCallResult.isErr()) {
  logger.error(
    initialCallResult.error,
    "Failed to fetch data from Tiko; are the credentials correct?"
  );
  process.exit(1);
}

const properties = initialCallResult.value;

logger.info(
  properties.map((p) => ({ id: p.id, name: p.name })),
  "List of properties"
);

const relevantPropertyId = configuration.tiko.propertyId ?? properties[0]?.id;

const relevantProperty = properties.find((p) => p.id === relevantPropertyId);

if (!relevantProperty) {
  logger.error("No properties found");
  process.exit(1);
}

const propertyId = relevantProperty.id;

const hassMqttConfiguration = computeHassMqttConfiguration(relevantProperty);
const commandTopics = Object.keys(hassMqttConfiguration.commandTopics);

const stateUpdater = new StateUpdater(
  tikoClient,
  propertyId,
  configuration.updateIntervalMinutes
);
const mqttCommandHandler = new MqttCommandHandler(
  stateUpdater,
  tikoClient,
  propertyId
);
stateUpdater.on("error", (err) => {
  logger.error(err, "Error from state updater");
  mqttPublisher.requestPublish([UNAVAILABLE_MESSAGE]);
});

const mqttClient = new MqttClient({
  config: configuration.mqtt,
  will: {
    topic: GLOBAL_AVAILABILITY_TOPIC,
    retain: true,
    message: "offline",
  },
  onConnect: () => {
    (async () => {
      logger.info("Connected to MQTT broker");

      const topicsToSubscribeTo = [HASS_MQTT_BIRTH_TOPIC, ...commandTopics];

      for (const topic of topicsToSubscribeTo) {
        if (!topic) continue;

        logger.info({ topic }, "Subscribing to topic");
        const subscribeResult = await mqttClient.subscribe(topic);

        if (subscribeResult.isErr()) {
          logger.error(
            subscribeResult.error,
            `Failed to subscribe to topic ${topic}`
          );
          return mqttClient.reconnect();
        }
      }

      stateUpdater.requestUpdate();
      logger.info("Connection ready");
    })().catch((err) => {
      logger.error(err, "Unexpected error during onConnect");
      return mqttClient.reconnect();
    });
  },
  onClose: () => {
    logger.warn("Disconnected from MQTT broker, will try to reconnect");
  },
  onError: (err) => {
    logger.error(err, "Error from MQTT client");
  },
  onMessage: (topic, message) => {
    (async () => {
      mqttCommandHandler.handleMessage(topic, message.toString());
    })().catch((err) => {
      logger.error(err, "Unexpected error during onMessage");
    });
  },
});

const mqttPublisher = new MqttPublisher(mqttClient);
mqttPublisher.on("error", (err) => {
  logger.error(err, "Error from MQTT publisher");
});

stateUpdater.on("update", (property) => {
  const hassMqttConfiguration = computeHassMqttConfiguration(property);
  mqttPublisher.requestPublish(hassMqttConfiguration.messages);
});
