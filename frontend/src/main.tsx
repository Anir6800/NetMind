import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { RouterProvider } from "react-router-dom";
import { router } from "./app/router";

const queryClient = new QueryClient();

export function App() {
  return <QueryClientProvider client={queryClient}><RouterProvider router={router} /></QueryClientProvider>;
}

import { createRoot } from "react-dom/client";
import "./styles/tokens.css";
import "./styles/global.css";

createRoot(document.getElementById("root")!).render(<App />);
