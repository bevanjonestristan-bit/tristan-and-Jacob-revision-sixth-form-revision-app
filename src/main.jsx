import React from "react";
import ReactDOM from "react-dom/client";

import App from "./App.jsx";
import "./index.css";

ReactDOM.createRoot(
  document.getElementById("root")
).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

if ("serviceWorker" in navigator) {
  window.addEventListener(
    "load",
    async () => {
      try {
        const registration =
          await navigator.serviceWorker.register(
            "/sw.js"
          );

        console.log(
          "Tristan Revision PWA service worker registered:",
          registration
        );
      } catch (error) {
        console.error(
          "PWA service worker registration failed:",
          error
        );
      }
    }
  );
}