import { useEffect } from "react";

import { formatDocumentTitle } from "@/lib/utils";

/**
 * Names the browser tab after the page, so staff with several tabs open
 * (results, attendance, the TV view) can tell them apart.
 */
export const useDocumentTitle = (...parts: (string | null | undefined)[]) => {
    const title = formatDocumentTitle(...parts);

    useEffect(() => {
        document.title = title;
    }, [title]);

    useEffect(
        () => () => {
            document.title = formatDocumentTitle();
        },
        []
    );
};
