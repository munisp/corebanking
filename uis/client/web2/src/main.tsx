import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App.tsx";
import { AuthProvider } from "./contexts/AuthContext.tsx";
import { TenantProvider } from "./contexts/TenantContext.tsx";
import { ThemeProvider } from "./contexts/ThemeContext";
import { TierProvider } from "./contexts/TierContext";
import { WalletProvider } from "./contexts/WalletContext.tsx";
import { registerServiceWorker } from "./utils/serviceWorkerRegistration";
import "./index.css";

// Register service worker for PWA functionality
registerServiceWorker();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <TenantProvider>
      <ThemeProvider>
        <TierProvider>
          <AuthProvider>
            <WalletProvider>
              <BrowserRouter>
                <App />
              </BrowserRouter>
            </WalletProvider>
          </AuthProvider>
        </TierProvider>
      </ThemeProvider>
    </TenantProvider>
  </StrictMode>
);