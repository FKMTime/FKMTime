import { useSearchParams } from "react-router-dom";

import PageTabs from "@/Components/shared/PageTabs";

import ImportScrambles from "./Tabs/ImportScrambles/ImportScrambles";
import ScrambleSets from "./Tabs/ScrambleSets/ScrambleSets";
import ScramblingDevices from "./Tabs/ScramblingDevices/ScramblingDevices";

type ScramblesTab = "scrambleSets" | "importScrambles" | "scramblingDevices";

const TABS: { value: ScramblesTab; label: string }[] = [
    { value: "scrambleSets", label: "Scramble sets" },
    { value: "importScrambles", label: "Import" },
    { value: "scramblingDevices", label: "Scrambling devices" },
];

const ScramblesAdmin = () => {
    const [searchParams, setSearchParams] = useSearchParams();
    const tab =
        TABS.find((t) => t.value === searchParams.get("tab"))?.value ??
        "scrambleSets";

    return (
        <>
            <PageTabs
                label="Scrambles"
                value={tab}
                onValueChange={(value) => setSearchParams({ tab: value })}
                tabs={TABS}
                className="max-md:-mt-4 max-md:bg-card"
            />
            {tab === "scrambleSets" && <ScrambleSets />}
            {tab === "importScrambles" && <ImportScrambles />}
            {tab === "scramblingDevices" && <ScramblingDevices />}
        </>
    );
};

export default ScramblesAdmin;
