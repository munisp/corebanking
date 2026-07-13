import morgan from "morgan";
import logger from "./logger.config";

const stream = {
  write: (message: string) => logger.http(message.trim()),
};

export default morgan("combined", { stream });
