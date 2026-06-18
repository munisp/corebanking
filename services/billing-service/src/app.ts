import "reflect-metadata";
import express from "express";
import cors from "cors";
import setupRoutes from "./setup/setupRoutes";
import setupBeforeMiddlewares from "./setup/setupBeforeMiddlewares";
import setupAfterMiddlewares from "./setup/setupAfterMiddlewares";

const app = express();

app.use(cors());
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));

setupBeforeMiddlewares(app);
setupRoutes(app);
setupAfterMiddlewares(app);

export default app;
