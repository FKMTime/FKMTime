import { useAtomValue } from "jotai";
import { useEffect, useState } from "react";

import LoadingPage from "@/Components/LoadingPage";
import { competitionAtom } from "@/lib/atoms";
import { getMostMissedAssignments } from "@/lib/attendance";
import { MissedAssignments } from "@/lib/interfaces";
import PageTransition from "@/Pages/PageTransition";

import MissedAssignmentsCard from "./Components/MissedAssignmentsCard";

const MostMissedAssignments = () => {
    const [assignments, setAssignments] = useState<MissedAssignments[]>([]);
    const competition = useAtomValue(competitionAtom);

    useEffect(() => {
        getMostMissedAssignments().then((data) => setAssignments(data));
    }, []);

    if (!competition) return <LoadingPage />;

    return (
        <PageTransition>
            {assignments.map((item) => (
                <MissedAssignmentsCard
                    assignments={item}
                    competition={competition}
                />
            ))}
        </PageTransition>
    );
};

export default MostMissedAssignments;
