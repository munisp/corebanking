import express from "express";
import compression from "compression";
import setupRoutes from "./setup/setupRoutes";
import setupBeforeMiddlewares from "./setup/setupBeforeMiddlewares";
import setupAfterMiddlewares from "./setup/setupAfterMiddlewares";

const app = express();

// OB-01: capture the raw request body so KYC/KYB callback HMAC signatures
// (x-callback-signature) can be verified over the exact bytes received.
app.use(
  express.json({
    verify: (req, _res, buf) => {
      (req as any).rawBody = buf;
    },
  }),
);

app.use(compression());
app.use(express.static("public"));

setupBeforeMiddlewares(app);
setupRoutes(app);
setupAfterMiddlewares(app);

export default app;
