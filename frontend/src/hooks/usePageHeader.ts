import { useSetAtom } from "jotai";
import { useEffect } from "react";

import { PageHeader, pageHeaderAtom } from "@/lib/atoms";

/**
 * Overrides the shell's breadcrumbs (desktop) and title/back button (mobile)
 * while the calling page is mounted.
 */
export const usePageHeader = (header: PageHeader) => {
    const setPageHeader = useSetAtom(pageHeaderAtom);
    const serialized = JSON.stringify(header);

    useEffect(() => {
        setPageHeader(JSON.parse(serialized));
        return () => setPageHeader(null);
    }, [serialized, setPageHeader]);
};
