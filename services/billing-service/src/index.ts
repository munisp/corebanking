import "reflect-metadata";
import app from "./app";
import setupServer from "./setup/setupServer";
import { tryInitializeDatabase } from "./setup/setupServiceInitializers";

setupServer(app, tryInitializeDatabase);
