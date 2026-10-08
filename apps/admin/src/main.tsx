import { ApolloProvider } from "@apollo/client/react";
import { RouterProvider } from "@tanstack/react-router";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { AppErrorBoundary } from "#components/AppErrorBoundary";
import "./index.css";
import { apolloClient } from "#lib/apollo-client";
import { setSessionEndedHandler } from "#lib/session";
import { router } from "./router";

// A request came back "not signed in" mid-use: drop cached data, sign in, come back.
setSessionEndedHandler(() => {
  const here = router.state.location;
  if (here.pathname === "/sign-in") return;
  void apolloClient.clearStore().then(() =>
    router.navigate({
      to: "/sign-in",
      search: { redirect: here.href, ended: true },
      replace: true,
    }),
  );
});

const rootElement = document.getElementById("root");
if (!rootElement) throw new Error("#root element not found");

createRoot(rootElement).render(
  <StrictMode>
    <AppErrorBoundary>
      <ApolloProvider client={apolloClient}>
        <RouterProvider router={router} />
      </ApolloProvider>
    </AppErrorBoundary>
  </StrictMode>,
);
