import type { Response } from "express";

import { HttpError } from "./http-error.js";

function sendErrorResponse(error: unknown, response: Response) {
  if (error instanceof HttpError) {
    response.status(error.statusCode).json({ error: error.message });
    return;
  }

  console.error(error);
  response.status(500).json({ error: "Internal server error" });
}

export { sendErrorResponse };
