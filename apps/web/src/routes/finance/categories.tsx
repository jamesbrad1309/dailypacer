import { createFileRoute } from "@tanstack/react-router";
import { CategoriesView } from "#components/finance/categories/CategoriesView";
import { MANAGE_CATEGORIES_QUERY } from "#graphql/finance";

export const Route = createFileRoute("/finance/categories")({
  staticData: { page: "categories" },
  loader: async ({ context: { apolloClient } }) => {
    await apolloClient.query({ query: MANAGE_CATEGORIES_QUERY });
  },
  component: CategoriesView,
});
