import { useAtomValue } from "jotai";
import { useEffect } from "react";

import PageTabs, { PageTab } from "@/Components/shared/PageTabs";
import { competitionAtom } from "@/lib/atoms";
import { competitionSettingsQuery } from "@/lib/competition";
import { prefetchQuery } from "@/lib/queryCache";
import { unofficialEventsQuery } from "@/lib/unofficialEvents";
import { usersQuery } from "@/lib/user";

export type SetupTab = "competition" | "events" | "users";

const ignoreFailure = () => undefined;

/** Loads a tab's code and data, so switching to it doesn't wait on either */
const PRELOAD_TAB: Record<SetupTab, () => void> = {
    competition: () => {
        import("@/Pages/Main/Competition/Competition").catch(ignoreFailure);
        prefetchQuery(competitionSettingsQuery);
    },
    events: () => {
        import("@/Pages/Main/UnofficialEvents/UnofficialEvents").catch(
            ignoreFailure
        );
        prefetchQuery(unofficialEventsQuery);
    },
    users: () => {
        import("@/Pages/Main/Users/Users").catch(ignoreFailure);
        prefetchQuery(usersQuery);
    },
};

/** Competition / Unofficial events / Users */
const SetupTabs = ({ value }: { value: SetupTab }) => {
    const competition = useAtomValue(competitionAtom);
    const useDevices = !!competition?.useFkmTimeDevices;

    const tabs: (PageTab<SetupTab> | false)[] = [
        { value: "competition", label: "Competition", to: "/competition" },
        useDevices && {
            value: "events",
            label: "Unofficial events",
            to: "/events",
        },
        { value: "users", label: "Users", to: "/users" },
    ];

    useEffect(() => {
        const preloaded: SetupTab[] = ["competition", "users"];
        if (useDevices) preloaded.push("events");
        preloaded.forEach((tab) => PRELOAD_TAB[tab]());
    }, [useDevices]);

    return (
        <PageTabs
            label="Setup"
            value={value}
            tabs={tabs.filter((tab): tab is PageTab<SetupTab> => !!tab)}
            className="max-md:-mt-4 max-md:bg-card"
        />
    );
};

export default SetupTabs;
