import { ZodSchema, z } from "zod";
import { Result, ResultAsync, err, ok } from "neverthrow";
import { getBeginningOfMonthTimestamp } from "../date.js";
import {
  GET_DATA_QUERY,
  LOGIN_MUTATION,
  QueryDefinition,
  SET_ROOM_MODE_MUTATION,
  SET_ROOM_TEMPERATURE_MUTATION,
} from "./query-responses.js";
import { Properties, mapPresetMode, mapProperties } from "./mappers.js";
import { TikoConfig } from "../config.js";
import { PresetMode } from "../hass.js";

export class TikoClient {
  private token?: string;

  constructor(private readonly config: TikoConfig) {}

  async getToken(): Promise<Result<string, Error>> {
    if (this.token) return ok(this.token);

    const dataResult = await doTikoRequest({
      queryDefinition: LOGIN_MUTATION,
      variables: {
        email: this.config.email,
        password: this.config.password,
      },
    });

    if (dataResult.isErr()) return err(dataResult.error);

    const data = dataResult.value;

    this.token = data.logIn.token;

    return ok(this.token);
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

    const responseResult = await doTikoRequest({
      queryDefinition: SET_ROOM_TEMPERATURE_MUTATION,
      variables: {
        propertyId: params.propertyId,
        roomId: params.roomId,
        temperature: params.targetTemperature,
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
  queryDefinition: QueryDefinition<VariablesSchema, DataSchema>;
  variables: z.infer<VariablesSchema>;
  token?: string;
};

async function doTikoRequest<
  VariablesSchema extends ZodSchema,
  DataSchema extends z.ZodSchema
>({
  queryDefinition,
  variables,
  token,
}: DoTikoRequestParams<VariablesSchema, DataSchema>): Promise<
  Result<z.infer<DataSchema>, Error>
> {
  const responseResult = await ResultAsync.fromPromise(
    fetch("https://particuliers-tiko.fr/api/v3/graphql/", {
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

  if (responseResult.isErr()) return responseResult;

  const response = responseResult.value;

  const jsonResult = await ResultAsync.fromPromise(
    response.json(),
    (err) => new Error("Unable to parse JSON", { cause: err })
  );

  if (jsonResult.isErr()) return jsonResult;

  const json = jsonResult.value;

  const completeDataSchema = z.object({
    data: queryDefinition.dataSchema,
  });

  const dataResult = completeDataSchema.safeParse(json);

  if (dataResult.success === false) {
    return err(dataResult.error);
  }

  const data = dataResult.data;

  return ok(data.data);
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
