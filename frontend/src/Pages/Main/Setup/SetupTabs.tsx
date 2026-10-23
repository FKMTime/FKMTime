import { useAtomValue } from "jotai";

import PageTabs, { PageTab } from "@/Components/shared/PageTabs";
import { competitionAtom } from "@/lib/atoms";

export type SetupTab =
    | "competition"
    | "groups"
    | "events"
    | "devices"
    | "users";

/** Competition / Current groups / Unofficial events / Devices / Users */
const SetupTabs = ({ value }: { value: SetupTab }) => {
    const competition = useAtomValue(competitionAtom);
    const useDevices = !!competition?.useFkmTimeDevices;

    const tabs: (PageTab<SetupTab> | false)[] = [
        { value: "competition", label: "Competition", to: "/competition" },
        { value: "groups", label: "Current groups", to: "/competition/groups" },
        useDevices && {
            value: "events",
            label: "Unofficial events",
            to: "/events",
        },
        useDevices && { value: "devices", label: "Devices", to: "/devices" },
        { value: "users", label: "Users", to: "/users" },
    ];

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
