import { useSetAtom } from "jotai";
import { useEffect } from "react";

import { PageHeader, pageHeaderAtom } from "@/lib/atoms";

/**
 * Overrides the shell's breadcrumbs (desktop) and title/back button (mobile)
 * while the calling page is mounted. Pass enabled=false to leave the header
 * to a nested page (child effects run first, so a parent would overwrite it).
 */
export const usePageHeader = (header: PageHeader, enabled = true) => {
    const setPageHeader = useSetAtom(pageHeaderAtom);
    const serialized = JSON.stringify(header);

    useEffect(() => {
        if (!enabled) return;
        setPageHeader(JSON.parse(serialized));
        return () => setPageHeader(null);
    }, [serialized, enabled, setPageHeader]);
};
