import EventEmitter from "node:events";
import { setTimeout } from "node:timers/promises";
import { type TikoClient } from "./tiko/client.js";
import { Property } from "./tiko/mappers.js";
import { logger } from "./logger.js";
import { TypedEmitter } from "./typed-emitter.js";

type StateUpdaterEvents = {
  update: (property: Property) => void;
  error: (error: Error) => void;
};

export class StateUpdater extends (EventEmitter as new () => TypedEmitter<StateUpdaterEvents>) {
  private updateRequested = false;
  private updating = false;
  private lastUpdateTimestamp = -1;

  constructor(
    private readonly tikoClient: TikoClient,
    private readonly propertyId: number,
    updateIntervalMinutes: number
  ) {
    super();

    setInterval(() => this.requestUpdate(), updateIntervalMinutes * 60 * 1_000);
  }

  requestUpdate() {
    this.updateRequested = true;
    this.update().catch((err) =>
      logger.error(err, "Unexpected error during requestUpdate update")
    );
  }

  private async update() {
    if (!this.updateRequested || this.updating) return;

    this.updating = true;
    this.updateRequested = false;

    const now = Date.now();
    const timeSinceLastRefresh = now - this.lastUpdateTimestamp;
    if (timeSinceLastRefresh < MIN_DELAY_BETWEEN_UPDATES) {
      await setTimeout(MIN_DELAY_BETWEEN_UPDATES - timeSinceLastRefresh);
    }

    const propertiesResult = await this.tikoClient.fetchData(new Date());

    if (propertiesResult.isOk()) {
      const properties = propertiesResult.value;
      const property = properties.find((p) => p.id === this.propertyId);

      if (property) {
        this.emit("update", property);
      } else {
        this.emit(
          "error",
          new Error(`Unable to find property ${this.propertyId}`)
        );
      }
    } else {
      this.emit("error", propertiesResult.error);
    }

    this.updating = false;
    this.lastUpdateTimestamp = Date.now();

    this.update().catch((err) =>
      logger.error(err, "Unexpected error during update update")
    );
  }
}

const MIN_DELAY_BETWEEN_UPDATES = 1_000;
