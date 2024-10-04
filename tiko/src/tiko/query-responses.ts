import { type } from "arktype";

export type QueryDefinition<
  VariablesSchema extends type.Any = type.Any,
  Schema extends type.Any = type.Any
> = {
  query: string;
  variablesSchema: VariablesSchema;
  dataSchema: Schema;
};

export const LOGIN_MUTATION = {
  query: `
  mutation LogIn($email: String!, $password: String!, $retainSession: Boolean!) {
    logIn(input: { email: $email, password: $password, retainSession: $retainSession }) {
      token
    }
  }
`,
  variablesSchema: type({
    email: "string",
    password: "string",
    retainSession: "boolean",
  }),
  dataSchema: type({
    logIn: {
      token: "string",
    },
  }),
} as const; // satisfies QueryDefinition;

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
  variablesSchema: type({
    consumptionStartTimestamp: "number",
    consumptionEndTimestamp: "number",
  }),
  dataSchema: type({
    properties: type({
      id: "number",
      name: "string",
      fastConsumption: {
        energyKwh: "number",
        roomsConsumption: type({
          id: "number",
          name: "string",
          energyKwh: "number",
        }).array(),
      },
      rooms: type({
        id: "number",
        name: "string",
        currentTemperatureDegrees: "number | null",
        // Mon Pilotage Elec does not have humidity sensors
        humidity: "number | null",
        targetTemperatureDegrees: "number",
        mode: type({
          absence: "boolean",
          boost: "boolean",
          disableHeating: "boolean",
          frost: "boolean",
        }),
        devices: type({
          id: "number",
          mac: "string",
          type: "string",
          code: "string",
        }).array(),
        status: {
          disconnected: "boolean",
          heatingOperating: "boolean",
          // Can also be the sensor ID
          sensorBatteryLow: "boolean | string",
          sensorDisconnected: "boolean | string",
        },
      })
        .array()
        .or("null"),
    }).array(),
  }),
} as const; // satisfies QueryDefinition;

export type GetDataResponse = (typeof GET_DATA_QUERY)["dataSchema"]["infer"];

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
  variablesSchema: type({
    propertyId: "number",
    roomId: "number",
    temperature: "number",
  }),
  dataSchema: type({
    setRoomAdjustTemperature: type({
      adjustTemperature: {
        active: "boolean",
        temperature: "number",
      },
    }),
  }),
} as const; // satisfies QueryDefinition;

export const SET_ROOM_TEMPERATURE_WITH_SCHEDULE_MUTATION = {
  query: `
    mutation SetRoomTemperatureWithSchedule($propertyId: Int!, $roomId: Int!, $temperature: Float!, $scheduleData: JSONString!) {
      setRoomAdjustTemperature(
        input: {propertyId: $propertyId, roomId: $roomId, temperature: $temperature}
      ) {
        adjustTemperature {
          active
          temperature
        }
      }

      setRoomTemperatureSchedule(
        input: {propertyId: $propertyId, roomId: $roomId, scheduleData: $scheduleData}
      ) {
        id
      }
    }
`,
  variablesSchema: type({
    propertyId: "number",
    roomId: "number",
    temperature: "number",
    scheduleData: "string",
  }),
  dataSchema: type({
    setRoomAdjustTemperature: {
      adjustTemperature: {
        active: "boolean",
        temperature: "number",
      },
    },
    setRoomTemperatureSchedule: {
      id: "number",
    },
  }),
} as const; // satisfies QueryDefinition;

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
  variablesSchema: type({
    propertyId: "number",
    roomId: "number",
    mode: "false | 'boost' | 'absence' | 'frost' | 'disableHeating'",
  }),
  dataSchema: type({
    setRoomMode: {
      mode: {
        absence: "boolean",
        boost: "boolean",
        disableHeating: "boolean",
        frost: "boolean",
      },
    },
  }),
} as const; // satisfies QueryDefinition;
