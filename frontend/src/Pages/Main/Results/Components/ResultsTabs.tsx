import PageTabs from "@/Components/shared/PageTabs";

interface ResultsTabsProps {
    value: "rounds" | "checks";
    roundId?: string;
}

const ResultsTabs = ({ value, roundId }: ResultsTabsProps) => (
    <PageTabs
        label="Results"
        value={value}
        tabs={[
            {
                value: "rounds",
                label: "Rounds",
                to: roundId ? `/results/round/${roundId}` : "/results",
            },
            {
                value: "checks",
                label: "Checks",
                to: roundId ? `/results/checks/${roundId}` : "/results/checks",
            },
        ]}
        className="max-md:-mt-4 max-md:bg-card"
    />
);

export default ResultsTabs;
