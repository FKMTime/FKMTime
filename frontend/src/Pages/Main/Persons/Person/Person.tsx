import { useAtomValue } from "jotai";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Navigate, useParams } from "react-router-dom";
import { getPersonFromWcif } from "wcif-helpers";

import Avatar from "@/Components/Avatar/Avatar";
import LoadingPage from "@/Components/LoadingPage";
import PageTabs, { PageTab } from "@/Components/shared/PageTabs";
import SectionLoading from "@/Components/shared/SectionLoading";
import { usePageHeader } from "@/hooks/usePageHeader";
import { competitionAtom } from "@/lib/atoms";
import { getStaffActivitiesByPersonId, noShowGroupIds } from "@/lib/attendance";
import { getIncidentsForPerson } from "@/lib/incidents";
import {
    Person as PersonData,
    PersonIncidents as PersonIncidentsData,
    Result,
    StaffActivity,
    Warning,
} from "@/lib/interfaces";
import {
    isDelegate,
    isStageLeaderOrOrganizerOrDelegate,
} from "@/lib/permissions";
import { getPersonById } from "@/lib/persons";
import { getPersonSchedule } from "@/lib/personSchedule";
import { getAllResultsByPersonId } from "@/lib/results";
import { regionNameByIso2 } from "@/lib/utils";
import { getWarningsForPerson } from "@/lib/warnings";
import { useNoShow } from "@/Pages/Main/Attendance/useNoShow";

import PersonIncidents from "./PersonIncidents";
import PersonResults from "./PersonResults";
import PersonSchedule from "./PersonSchedule";
import PersonWarnings from "./PersonWarnings";

type PersonTab = "schedule" | "results" | "incidents" | "warnings";

const TAB_LABELS: Record<PersonTab, string> = {
    schedule: "Schedule",
    results: "Results",
    incidents: "Incidents",
    warnings: "Warnings",
};

const incidentsCount = (incidents: PersonIncidentsData | null) =>
    incidents
        ? incidents.attempts.length +
          incidents.manual.length +
          incidents.noteworthy.length
        : undefined;

/** One person: their schedule, results, incidents and warnings */
const Person = () => {
    const { id, tab = "schedule" } = useParams<{ id: string; tab?: string }>();
    const competition = useAtomValue(competitionAtom);
    const [person, setPerson] = useState<PersonData | null>(null);
    const [results, setResults] = useState<Result[] | null>(null);
    const [staffActivities, setStaffActivities] = useState<
        StaffActivity[] | null
    >(null);
    const [incidents, setIncidents] = useState<PersonIncidentsData | null>(
        null
    );
    const [warnings, setWarnings] = useState<Warning[] | null>(null);

    const showResults = !!competition?.useFkmTimeDevices;
    const showAttendance = isStageLeaderOrOrganizerOrDelegate();
    const showIncidents = isDelegate();

    const fetchStaffActivities = useCallback(() => {
        if (id) getStaffActivitiesByPersonId(id).then(setStaffActivities);
    }, [id]);
    const setNoShowFor = useNoShow(fetchStaffActivities);

    const fetchWarnings = useCallback(() => {
        if (id) getWarningsForPerson(id).then(setWarnings);
    }, [id]);

    useEffect(() => {
        if (!id) return;
        getPersonById(id).then(setPerson);
        if (showResults) getAllResultsByPersonId(id).then(setResults);
        if (showAttendance) fetchStaffActivities();
        if (showIncidents) {
            getIncidentsForPerson(id).then(setIncidents);
            fetchWarnings();
        }
    }, [
        id,
        showResults,
        showAttendance,
        showIncidents,
        fetchStaffActivities,
        fetchWarnings,
    ]);

    const schedule = useMemo(
        () =>
            competition && person
                ? getPersonSchedule(
                      competition.wcif,
                      person.registrantId,
                      staffActivities ?? []
                  )
                : [],
        [competition, person, staffActivities]
    );

    const counts: Record<PersonTab, number | undefined> = {
        schedule: schedule.length,
        results: results?.length,
        incidents: incidentsCount(incidents),
        warnings: warnings?.length,
    };
    const visible: Record<PersonTab, boolean> = {
        schedule: true,
        results: showResults,
        incidents: showIncidents,
        warnings: showIncidents,
    };
    const tabs: PageTab<PersonTab>[] = (Object.keys(TAB_LABELS) as PersonTab[])
        .filter((value) => visible[value])
        .map((value) => ({
            value,
            label: TAB_LABELS[value],
            count: counts[value],
            to: `/persons/${id}${value === "schedule" ? "" : `/${value}`}`,
        }));
    const activeTab = tabs.find((item) => item.value === tab);

    usePageHeader({
        crumbs: [
            { label: "Persons", to: "/persons" },
            { label: person?.name ?? "Person" },
        ],
        title: person?.name ?? "Person",
        subtitle: activeTab?.label,
        backTo: "/persons",
    });

    if (!person || !competition) return <LoadingPage />;
    if (!activeTab) return <Navigate to={`/persons/${id}`} replace />;

    const wcifPerson = person.registrantId
        ? getPersonFromWcif(person.registrantId, competition.wcif)
        : undefined;

    const content = () => {
        switch (activeTab.value) {
            case "results":
                return results ? (
                    <PersonResults results={results} />
                ) : (
                    <SectionLoading label="Loading results" />
                );
            case "incidents":
                return incidents ? (
                    <PersonIncidents
                        personId={person.id}
                        incidents={incidents}
                    />
                ) : (
                    <SectionLoading label="Loading incidents" />
                );
            case "warnings":
                return warnings ? (
                    <PersonWarnings
                        person={person}
                        warnings={warnings}
                        onChange={fetchWarnings}
                    />
                ) : (
                    <SectionLoading label="Loading warnings" />
                );
            default:
                return showAttendance && !staffActivities ? (
                    <SectionLoading label="Loading schedule" />
                ) : (
                    <PersonSchedule
                        entries={schedule}
                        canOpenAttendance={showAttendance}
                        onSetNoShow={
                            showAttendance
                                ? (day, noShow) =>
                                      setNoShowFor(
                                          person,
                                          noShowGroupIds(
                                              competition.wcif,
                                              staffActivities ?? [],
                                              day
                                          ),
                                          noShow
                                      )
                                : undefined
                        }
                    />
                );
        }
    };

    return (
        <div className="flex flex-col gap-5">
            <header className="flex items-center gap-4">
                <Avatar
                    username={person.name}
                    avatarUrl={wcifPerson?.avatar?.thumbUrl}
                    fullAvatarUrl={wcifPerson?.avatar?.url}
                    className="size-14"
                />
                <div className="min-w-0">
                    <h2 className="truncate text-xl font-bold">
                        {person.name}
                    </h2>
                    <p className="text-sm text-muted-foreground">
                        {[
                            person.registrantId && `ID ${person.registrantId}`,
                            person.wcaId ?? "Newcomer",
                            person.countryIso2 &&
                                regionNameByIso2(person.countryIso2),
                        ]
                            .filter(Boolean)
                            .join(" · ")}
                    </p>
                </div>
            </header>

            {tabs.length > 1 && (
                <PageTabs label="Person" value={activeTab.value} tabs={tabs} />
            )}

            {content()}
        </div>
    );
};

export default Person;
