import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { lazy, Suspense } from "react";
import { createRoot } from "react-dom/client";
import { getLoginUrl } from "./const";
import "./index.css";

const App = lazy(() => import("./App"));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, refetchOnWindowFocus: false },
  },
});

const redirectToLoginIfUnauthorized = (error: unknown) => {
  if (typeof window === "undefined") return;
  const status = (error as any)?.response?.status ?? (error as any)?.status;
  if (status === 401) {
    window.location.href = getLoginUrl();
  }
};

queryClient.getQueryCache().subscribe((event) => {
  if (event.type === "updated" && event.action.type === "error") {
    const error = event.query.state.error;
    redirectToLoginIfUnauthorized(error);
    console.error("[Query Error]", error);
  }
});

queryClient.getMutationCache().subscribe((event) => {
  if (event.type === "updated" && event.action.type === "error") {
    const error = event.mutation.state.error;
    redirectToLoginIfUnauthorized(error);
    console.error("[Mutation Error]", error);
  }
});

createRoot(document.getElementById("root")!).render(
  <QueryClientProvider client={queryClient}>
    <Suspense
      fallback={
        <div className="flex items-center justify-center h-screen">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-slate-600" />
        </div>
      }
    >
      <App />
    </Suspense>
  </QueryClientProvider>
);
