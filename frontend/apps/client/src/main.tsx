import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { AuthProvider } from "@mwrd/auth";
import { LocaleProvider } from "@mwrd/i18n";
import "./index.css";
import App from "./App";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    {/* R14 — LocaleProvider must wrap AuthProvider so login screens can
        translate themselves. It also flips <html dir> on mount, which
        Tailwind / CSS logical properties react to. */}
    <LocaleProvider>
      <AuthProvider>
        <App />
      </AuthProvider>
    </LocaleProvider>
  </StrictMode>
);
