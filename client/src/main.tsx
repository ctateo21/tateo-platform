import { createRoot } from "react-dom/client";
import { ThemeProvider } from "@/components/ui/theme-provider";
import App from "./App";
import { initPosthog } from "@/lib/posthog";
import "./index.css";

initPosthog();

createRoot(document.getElementById("root")!).render(
  <ThemeProvider defaultTheme="light" storageKey="tateo-theme">
    <App />
  </ThemeProvider>
);
