import { HttpError } from "../errors/http-error.js";

import { CONNECTION_STATUSES } from "./connection.types.js";
import type {
  ConnectionActorInput,
  ConnectionStatus,
  CreateConnectionInput,
  ListConnectionsInput,
} from "./connection.types.js";

function parseCreateConnectionInput(body: unknown): CreateConnectionInput {
  if (!body || typeof body !== "object") {
    throw new HttpError(400, "Request body must be a JSON object");
  }

  return {
    requester_id: readRequiredString(body, "requester_id"),
    addressee_id: readRequiredString(body, "addressee_id"),
  };
}

function parseConnectionActorInput(
  params: { id?: string | string[] },
  query: unknown,
): ConnectionActorInput {
  return {
    connection_id: readPathId(params),
    user_id: readUserIdQuery(query),
  };
}

function parseListConnectionsInput(query: unknown): ListConnectionsInput {
  const user_id = readUserIdQuery(query);
  const status = readOptionalStatusQuery(query);

  return { user_id, status };
}

function readPathId(params: { id?: string | string[] }): string {
  const value = params.id;

  if (Array.isArray(value)) {
    return readNonEmptyString(value[0], "connection id is required");
  }

  return readNonEmptyString(value, "connection id is required");
}

function readUserIdQuery(query: unknown): string {
  if (!query || typeof query !== "object") {
    throw new HttpError(400, "user_id query parameter is required");
  }

  return readRequiredString(query, "user_id", "user_id query parameter is required");
}

function readOptionalStatusQuery(query: unknown): ConnectionStatus | undefined {
  if (!query || typeof query !== "object") {
    return undefined;
  }

  const value = Reflect.get(query, "status");

  if (value === undefined) {
    return undefined;
  }

  const status = normalizeSingleString(value, "status query parameter must be a string");

  if (!CONNECTION_STATUSES.includes(status as ConnectionStatus)) {
    throw new HttpError(400, `status must be one of: ${CONNECTION_STATUSES.join(", ")}`);
  }

  return status as ConnectionStatus;
}

function readRequiredString(
  body: object,
  fieldName: string,
  message = `${fieldName} is required`,
): string {
  return readNonEmptyString(Reflect.get(body, fieldName), message);
}

function readNonEmptyString(value: unknown, message: string): string {
  const normalized = normalizeSingleString(value, message);

  if (normalized.trim() === "") {
    throw new HttpError(400, message);
  }

  return normalized.trim();
}

function normalizeSingleString(value: unknown, message: string): string {
  if (Array.isArray(value)) {
    return normalizeSingleString(value[0], message);
  }

  if (typeof value !== "string") {
    throw new HttpError(400, message);
  }

  return value;
}

export { parseConnectionActorInput, parseCreateConnectionInput, parseListConnectionsInput };
