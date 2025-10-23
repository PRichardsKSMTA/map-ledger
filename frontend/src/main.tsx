import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./index.css";

import { MsalProvider } from "@azure/msal-react";
import { msalInstance, initializeMsal } from "./utils/msal";

const rootEl = document.getElementById("root")!;

initializeMsal().then(() => {
  ReactDOM.createRoot(rootEl).render(
    <React.StrictMode>
      <MsalProvider instance={msalInstance}>
        <App />
      </MsalProvider>
    </React.StrictMode>
  );
}).catch((e) => {
  // Surface init problems early
  console.error("MSAL initialization failed:", e);
  ReactDOM.createRoot(rootEl).render(
    <div style={{ color: "red", padding: 24, fontFamily: "system-ui" }}>
      MSAL initialization failed. Check your environment variables and redirect URI.
      <pre>{String(e)}</pre>
    </div>
  );
});
