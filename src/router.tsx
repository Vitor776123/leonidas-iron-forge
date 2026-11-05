import { QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";

export const getRouter = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000, // volta para uma aba sem refazer a consulta toda hora
        refetchOnWindowFocus: false, // no celular, voltar ao app não deve piscar a tela
        retry: 1,
      },
    },
  });

  const router = createRouter({
    routeTree,
    context: { queryClient },
    scrollRestoration: true,
    defaultPreload: "intent", // já baixa a tela ao tocar/passar o dedo, sem esperar o clique
    defaultPreloadStaleTime: 0,
  });

  return router;
};
