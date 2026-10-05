import React from "react";
import ReactDOM from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import AppRoutes from "./AppRoutes";
import { Toaster } from "react-hot-toast";
import { ToastProvider } from "./context/ToastContext";
import "./index.css";

const root = document.getElementById("root");

if (!root) {
  throw new Error("Root element not found");
}

const queryClient = new QueryClient();

ReactDOM.createRoot(root).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <AppRoutes />
        <Toaster position="top-right" />
      </ToastProvider>
    </QueryClientProvider>
  </React.StrictMode>
);
