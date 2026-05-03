import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { AuthProvider } from "@mwrd/auth";
import { LocaleProvider } from "@mwrd/i18n";
import "./index.css";
import App from "./App";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <LocaleProvider>
      <AuthProvider>
        <App />
      </AuthProvider>
    </LocaleProvider>
  </StrictMode>
);
