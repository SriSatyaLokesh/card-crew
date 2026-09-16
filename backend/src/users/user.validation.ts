import { HttpError } from "../errors/http-error.js";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const EMAIL_MAX_LENGTH = 254;
const DISPLAY_NAME_MAX_LENGTH = 80;
const PHONE_MAX_LENGTH = 32;

type SyncUserBodyInput = {
  email?: string;
  phone?: string | null;
  display_name?: string;
};

function parseSyncUserInput(body: unknown): SyncUserBodyInput {
  if (!body || typeof body !== "object") {
    throw new HttpError(400, "Request body must be a JSON object");
  }

  const input: SyncUserBodyInput = {};
  const email = readOptionalTrimmedString(body, "email");
  const displayName = readOptionalTrimmedString(body, "display_name");
  const phone = readOptionalPhone(body);

  if (email !== undefined) {
    if (!EMAIL_PATTERN.test(email)) {
      throw new HttpError(400, "Email must be a valid email address");
    }

    if (email.length > EMAIL_MAX_LENGTH) {
      throw new HttpError(400, `email must be ${EMAIL_MAX_LENGTH} characters or fewer`);
    }

    input.email = email.toLowerCase();
  }

  if (displayName !== undefined) {
    if (displayName.length > DISPLAY_NAME_MAX_LENGTH) {
      throw new HttpError(400, `display_name must be ${DISPLAY_NAME_MAX_LENGTH} characters or fewer`);
    }

    input.display_name = displayName;
  }

  if (phone !== undefined) {
    if (phone !== null && phone.length > PHONE_MAX_LENGTH) {
      throw new HttpError(400, `phone must be ${PHONE_MAX_LENGTH} characters or fewer`);
    }

    input.phone = phone;
  }

  return input;
}

function readOptionalTrimmedString(
  body: object,
  fieldName: "email" | "display_name",
): string | undefined {
  const value = Reflect.get(body, fieldName);

  if (value === undefined) {
    return undefined;
  }

  if (typeof value !== "string" || value.trim() === "") {
    throw new HttpError(400, `${fieldName} must be a non-empty string`);
  }

  return value.trim();
}

function readOptionalPhone(body: object): string | null | undefined {
  const value = Reflect.get(body, "phone");

  if (value === undefined) {
    return undefined;
  }

  if (value === null) {
    return null;
  }

  if (typeof value !== "string") {
    throw new HttpError(400, "phone must be a string or null");
  }

  const normalizedValue = value.trim();
  return normalizedValue === "" ? null : normalizedValue;
}

export { parseSyncUserInput };
