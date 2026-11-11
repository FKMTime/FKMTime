import { QueryClientProvider } from "@tanstack/react-query";
import { render, RenderOptions } from "@testing-library/react";
import { createElement, ReactElement, ReactNode } from "react";

import { queryClient } from "@/lib/queryClient";

/** The app's query client, so `useQuery` shares the cache `queryCache` uses */
export const QueryWrapper = ({ children }: { children: ReactNode }) =>
    createElement(QueryClientProvider, { client: queryClient }, children);

/** Renders inside the app's query client. Call clearQueryCache between tests. */
export const renderWithQueryClient = (
    ui: ReactElement,
    options?: Omit<RenderOptions, "wrapper">
) => render(ui, { wrapper: QueryWrapper, ...options });
