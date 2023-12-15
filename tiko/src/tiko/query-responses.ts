import { z } from "zod";

export type QueryDefinition<
  VariablesSchema extends z.ZodSchema = z.ZodSchema,
  Schema extends z.ZodSchema = z.ZodSchema
> = {
  query: string;
  variablesSchema: VariablesSchema;
  dataSchema: Schema;
};

export const LOGIN_MUTATION = {
  query: `
  mutation LogIn($email: String!, $password: String!) {
    logIn(input: { email: $email, password: $password }) {
      token
    }
  }
`,
  variablesSchema: z.object({
    email: z.string(),
    password: z.string(),
  }),
  dataSchema: z.object({
    logIn: z.object({
      token: z.string(),
    }),
  }),
} as const satisfies QueryDefinition;

export const GET_DATA_QUERY = {
  query: `
    query GetData($consumptionStartTimestamp: BigInt!, $consumptionEndTimestamp: BigInt!) {
      properties {
        id
        name
        fastConsumption(start: $consumptionStartTimestamp, end: $consumptionEndTimestamp) {
          energyKwh
          roomsConsumption {
            id
            name
            energyKwh
          }
        }
        rooms {
          id
          name
          currentTemperatureDegrees
          humidity
          targetTemperatureDegrees
          mode {
            absence
            boost
            disableHeating
            frost
          }
          devices {
            id
            mac
            type
            code
          }
          status {
            disconnected
            heatingOperating
            sensorBatteryLow
            sensorDisconnected
          }
        }
      }
    }
  `,
  variablesSchema: z.object({
    consumptionStartTimestamp: z.number(),
    consumptionEndTimestamp: z.number(),
  }),
  dataSchema: z.object({
    properties: z.array(
      z.object({
        id: z.number(),
        name: z.string(),
        fastConsumption: z.object({
          energyKwh: z.number(),
          roomsConsumption: z.array(
            z.object({
              id: z.number(),
              name: z.string(),
              energyKwh: z.number(),
            })
          ),
        }),
        rooms: z
          .array(
            z.object({
              id: z.number(),
              name: z.string(),
              currentTemperatureDegrees: z.number(),
              humidity: z.number(),
              targetTemperatureDegrees: z.number(),
              mode: z.object({
                absence: z.boolean(),
                boost: z.boolean(),
                disableHeating: z.boolean(),
                frost: z.boolean(),
              }),
              devices: z.array(
                z.object({
                  id: z.number(),
                  mac: z.string(),
                  type: z.string(),
                  code: z.string(),
                })
              ),
              status: z.object({
                disconnected: z.boolean(),
                heatingOperating: z.boolean(),
                sensorBatteryLow: z.boolean(),
                sensorDisconnected: z.boolean(),
              }),
            })
          )
          .nullable(),
      })
    ),
  }),
} as const satisfies QueryDefinition;

export type GetDataResponse = z.infer<(typeof GET_DATA_QUERY)["dataSchema"]>;

export const SET_ROOM_TEMPERATURE_MUTATION = {
  query: `
    mutation SetRoomTemperature($propertyId: Int!, $roomId: Int!, $temperature: Float!) {
      setRoomAdjustTemperature(
        input: {propertyId: $propertyId, roomId: $roomId, temperature: $temperature}
      ) {
        adjustTemperature {
          active
          temperature
        }
      }
    }
`,
  variablesSchema: z.object({
    propertyId: z.number(),
    roomId: z.number(),
    temperature: z.number(),
  }),
  dataSchema: z.object({
    setRoomAdjustTemperature: z.object({
      adjustTemperature: z.object({
        active: z.boolean(),
        temperature: z.number(),
      }),
    }),
  }),
} as const satisfies QueryDefinition;

export const SET_ROOM_MODE_MUTATION = {
  query: `
    mutation SetRoomMode($propertyId: Int!, $roomId: Int!, $mode: String!) {
      setRoomMode(
        input: {propertyId: $propertyId, roomId: $roomId, mode: $mode}
      ) {
        mode {
          absence
          boost
          disableHeating
          frost
        }
      }
    }
`,
  variablesSchema: z.object({
    propertyId: z.number(),
    roomId: z.number(),
    mode: z.union([
      z.literal(false),
      z.literal("boost"),
      z.literal("absence"),
      z.literal("frost"),
      z.literal("disableHeating"),
    ]),
  }),
  dataSchema: z.object({
    setRoomMode: z.object({
      mode: z.object({
        absence: z.boolean(),
        boost: z.boolean(),
        disableHeating: z.boolean(),
        frost: z.boolean(),
      }),
    }),
  }),
} as const satisfies QueryDefinition;
