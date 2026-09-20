import "./otel/init"; // MUST be the first import: initializes OpenTelemetry before instrumented modules load
import "reflect-metadata";
import app from "./app";
import setupServer from "./setup/setupServer";
import { tryInitializeDatabase } from "./setup/setupServiceInitializers";

setupServer(app, tryInitializeDatabase);
