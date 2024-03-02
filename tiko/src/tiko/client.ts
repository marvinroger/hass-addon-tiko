import { ZodSchema, z } from "zod";
import { Result, ResultAsync, err, ok } from "neverthrow";
// @ts-expect-error see https://github.com/valeriangalliat/fetch-cookie/issues/84
import makeFetchCookie from "fetch-cookie";
import { getBeginningOfMonthTimestamp } from "../date.js";
import {
  GET_DATA_QUERY,
  LOGIN_MUTATION,
  QueryDefinition,
  SET_ROOM_MODE_MUTATION,
  SET_ROOM_TEMPERATURE_MUTATION,
  SET_ROOM_TEMPERATURE_WITH_SCHEDULE_MUTATION,
} from "./query-responses.js";
import { Properties, mapPresetMode, mapProperties } from "./mappers.js";
import { TikoConfig } from "../config.js";
import { PresetMode } from "../hass.js";
import { DOMAIN_PER_PROVIDER } from "./providers.js";
import { validate } from "../lib/validation.js";
import { logger } from "../logger.js";
import { setTimeout } from "node:timers/promises";

export class TikoClient {
  private domain: string;
  private bypassSchedule: boolean;

  private token?: {
    value: string;
    expiresAt: Date;
  };

  constructor(private readonly config: TikoConfig) {
    this.domain = DOMAIN_PER_PROVIDER[config.provider];
    this.bypassSchedule = config.bypassSchedule;
  }

  async getToken(): Promise<Result<string, Error>> {
    if (this.token && this.token.expiresAt.getTime() > Date.now()) {
      return ok(this.token.value);
    }

    const dataResult = await doTikoRequest({
      domain: this.domain,
      queryDefinition: LOGIN_MUTATION,
      variables: {
        email: this.config.email,
        password: this.config.password,
      },
    });

    if (dataResult.isErr()) {
      return err(
        new Error(
          "Unable to get a token from Tiko; are the credentials correct?",
          { cause: dataResult.error }
        )
      );
    }

    const data = dataResult.value;

    this.token = {
      value: data.logIn.token,
      expiresAt: new Date(Date.now() + TIKO_TOKEN_LIFESPAN_MS),
    };

    return ok(this.token.value);
  }

  async fetchData(timeReference: Date): Promise<Result<Properties, Error>> {
    const tokenResult = await this.getToken();

    if (tokenResult.isErr()) return err(tokenResult.error);

    const token = tokenResult.value;

    const consumptionStartTimestamp = getBeginningOfMonthTimestamp({
      year: timeReference.getUTCFullYear(),
      month: timeReference.getUTCMonth() + 1,
    });

    // tiko seems to be caching the consumption data based on the consumptionStartTimestamp and consumptionEndTimestamp
    // Always requesting the same time range would not return fresh data
    // That's why we accept a `timeReference` parameter
    const consumptionEndTimestamp = timeReference.getTime();

    const responseResult = await doTikoRequest({
      domain: this.domain,
      queryDefinition: GET_DATA_QUERY,
      variables: {
        consumptionStartTimestamp,
        consumptionEndTimestamp,
      },
      token,
    });

    if (responseResult.isErr()) return err(responseResult.error);

    const response = responseResult.value;

    const propertiesResult = mapProperties(response);

    if (propertiesResult.isErr()) return err(propertiesResult.error);

    const properties = propertiesResult.value;

    return ok(properties);
  }

  async setRoomTargetTemperature(params: {
    propertyId: number;
    roomId: number;
    targetTemperature: number;
  }): Promise<Result<void, Error>> {
    const tokenResult = await this.getToken();

    if (tokenResult.isErr()) return err(tokenResult.error);

    const token = tokenResult.value;

    const schedule = Object.fromEntries(
      SCHEDULE_DAYS.map((day) => [day, [["00:00", params.targetTemperature]]])
    );

    const responseResult = await doTikoRequest({
      domain: this.domain,
      queryDefinition: this.bypassSchedule
        ? SET_ROOM_TEMPERATURE_WITH_SCHEDULE_MUTATION
        : SET_ROOM_TEMPERATURE_MUTATION,
      variables: {
        propertyId: params.propertyId,
        roomId: params.roomId,
        temperature: params.targetTemperature,
        ...(this.bypassSchedule
          ? { scheduleData: JSON.stringify(schedule) }
          : {}),
      },
      token,
    });

    if (responseResult.isErr()) return err(responseResult.error);

    const response = responseResult.value;

    if (
      !response.setRoomAdjustTemperature.adjustTemperature.active ||
      response.setRoomAdjustTemperature.adjustTemperature.temperature !==
        params.targetTemperature
    ) {
      return err(new Error(`Unable to set room temperature`));
    }

    return ok(undefined);
  }

  async setRoomMode(params: {
    propertyId: number;
    roomId: number;
    mode: PresetMode;
  }): Promise<Result<void, Error>> {
    const tokenResult = await this.getToken();

    if (tokenResult.isErr()) return err(tokenResult.error);

    const token = tokenResult.value;

    const responseResult = await doTikoRequest({
      domain: this.domain,
      queryDefinition: SET_ROOM_MODE_MUTATION,
      variables: {
        propertyId: params.propertyId,
        roomId: params.roomId,
        mode: TIKO_MUTATION_MODE_PER_PRESET_MODE[params.mode],
      },
      token,
    });

    if (responseResult.isErr()) return err(responseResult.error);

    const response = responseResult.value;

    const presetModeResult = mapPresetMode(response.setRoomMode.mode);

    if (presetModeResult.isErr()) return err(presetModeResult.error);

    if (presetModeResult.value !== params.mode) {
      return err(new Error(`Unable to set room mode`));
    }

    return ok(undefined);
  }
}

type DoTikoRequestParams<
  VariablesSchema extends z.ZodSchema,
  DataSchema extends z.ZodSchema
> = {
  domain: string;
  queryDefinition: QueryDefinition<VariablesSchema, DataSchema>;
  variables: z.infer<VariablesSchema>;
  token?: string;
};

const fetchCookie: typeof fetch = makeFetchCookie(fetch);

async function doTikoRequest<
  VariablesSchema extends ZodSchema,
  DataSchema extends z.ZodSchema
>({
  domain,
  queryDefinition,
  variables,
  token,
}: DoTikoRequestParams<VariablesSchema, DataSchema>): Promise<
  Result<z.infer<DataSchema>, Error>
> {
  while (true) {
    const responseResult = await ResultAsync.fromPromise(
      fetchCookie(`https://${domain}/api/v3/graphql/`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `token ${token}` } : {}),
        },
        body: JSON.stringify({
          query: queryDefinition.query,
          variables,
        }),
      }),
      (err) => new Error("Request failed", { cause: err })
    );

    if (responseResult.isErr()) return err(responseResult.error);

    const response = responseResult.value;

    const jsonResult = await ResultAsync.fromPromise(
      response.json(),
      (err) => new Error("Unable to parse JSON", { cause: err })
    );

    if (jsonResult.isErr()) return err(jsonResult.error);

    const json = jsonResult.value;

    const tikoErrorsResult = validate(TIKO_ERRORS_SCHEMA, json);

    if (tikoErrorsResult.isOk() && tikoErrorsResult.value.errors.length > 0) {
      if (
        tikoErrorsResult.value.errors.some((error) =>
          error.message.startsWith("Limite de taux atteinte")
        )
      ) {
        logger.warn(
          "tiko rate limit reached. Waiting 2 minutes before trying again"
        );
        await setTimeout(60 * 2 * 1_000);
        continue;
      }

      return err(
        new Error(
          `The tiko API returned an error: ${JSON.stringify(
            tikoErrorsResult.value
          )}`
        )
      );
    }

    const completeDataSchema = z.object({
      data: queryDefinition.dataSchema,
    });

    const dataResult = validate(completeDataSchema, json);

    if (dataResult.isErr()) {
      return err(
        new Error("The data from tiko was not the expected shape", {
          cause: dataResult.error,
        })
      );
    }

    const data = dataResult.value;

    return ok(data.data);
  }
}

const TIKO_MUTATION_MODE_PER_PRESET_MODE: Record<
  PresetMode,
  false | "absence" | "boost" | "disableHeating" | "frost"
> = {
  none: false,
  off: "disableHeating",
  away: "absence",
  boost: "boost",
  frostprotection: "frost",
};

const SCHEDULE_DAYS = ["0", "1", "2", "3", "4", "5", "6"];

const TIKO_ERRORS_SCHEMA = z.object({
  errors: z.array(
    z.object({
      message: z.string(),
    })
  ),
});

const TIKO_TOKEN_LIFESPAN_MS = 12 * 60 * 60 * 1_000;
