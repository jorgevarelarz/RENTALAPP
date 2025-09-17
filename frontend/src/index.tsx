import React from "react";
import ReactDOM from "react-dom/client";
import "./index.css";
import AppRoutes from "./AppRoutes";
import { ThemeProvider } from "./context/ThemeContext";
import { ToastProvider } from "./context/ToastContext";
import { NotificationsProvider } from "./utils/notify";
import reportWebVitals from "./reportWebVitals";
import axios from "axios";

axios.defaults.baseURL = process.env.REACT_APP_API_URL || process.env.VITE_API_URL || "";

const root = ReactDOM.createRoot(document.getElementById("root") as HTMLElement);
root.render(
  <React.StrictMode>
    <ThemeProvider>
      <ToastProvider>
        <NotificationsProvider>
          <AppRoutes />
        </NotificationsProvider>
      </ToastProvider>
    </ThemeProvider>
  </React.StrictMode>
);

reportWebVitals();
