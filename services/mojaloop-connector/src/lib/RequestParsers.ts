import { NextFunction, Request, Response } from "express";
import createLogger from "../config/logger.config";
import { extract_name_form_path } from "../utils/helpers";

const logger = createLogger(extract_name_form_path(__filename));

const processInput = async (req: Request, contentType: string) => {
  return new Promise<void>((response) => {
    // TS-35: collect Buffer chunks and concat once — avoids O(n^2) string
    // concatenation on chunked FSPIOP requests.
    const chunks: Buffer[] = [];

    // Collect the raw body data
    req.on("data", (chunk: Buffer) => {
      chunks.push(chunk);
    });

    req.on("end", () => {
      try {
        const rawBody = Buffer.concat(chunks).toString("utf8");
        // TS-34: full request bodies (incl. PII) only at debug level
        // (LOG_LEVEL=debug), never on the default info path.
        logger.debug("Body Collected, attempt to parse", { rawBody });
        // Parse the raw body into JSON (or any other format you need)
        const parsedBody = JSON.parse(rawBody);

        logger.debug("parsed body", { parsedBody });

        // Optionally, handle versioning if needed
        const version = contentType.split("version=")[1];
        if (version) {
          parsedBody.content_type_version = version; // Attach version to the parsed body
        }

        // Attach the parsed body to the request object
        req.body = parsedBody;
      } catch (error) {
        logger.error("error parsing", error);
      } finally {
        response();
      }
    });
  });
};

export const customMojaloopJsonParser = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const contentType = req.headers["content-type"];

  logger.debug("customMojaloopJsonParser ", { contentType });

  if (
    contentType &&
    (contentType.includes("application/vnd.interoperability.parties+json") ||
      contentType.includes(
        "application/vnd.interoperability.participants+json"
      ) ||
      contentType.includes("application/vnd.interoperability.quotes+json") ||
      contentType.includes("application/vnd.interoperability.transfers+json"))
  ) {
    await processInput(req, contentType);
  }

  next();
};

export const setMojaloopRequiredHeaders = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const accept_header = req.headers["accept"];

  if (accept_header) {
    res.setHeader("content-type", accept_header);
  }

  res.setHeader("date", new Date().toISOString());

  next();
};
