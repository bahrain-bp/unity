import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import { ProvideAuth } from "./auth/AuthProvider";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ProvideAuth>
      <App />
    </ProvideAuth>
  </StrictMode>
);
