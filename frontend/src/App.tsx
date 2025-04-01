import { lazy, useState } from "react";
import { createBrowserRouter, RouterProvider } from "react-router-dom";

import { Toaster } from "@/Components/ui/toaster";
import { ConfirmProvider } from "@/providers/ConfirmProvider";
import { ThemeProvider } from "@/providers/ThemeProvider";

import { THEME_STORAGE_KEY } from "./lib/constants";
import { SocketContext } from "./socket";
const CompetitionStatistics = lazy(
    () => import("./Components/CompetitionStatistics/CompetitionStatistics")
);
const Login = lazy(() => import("./Pages/Auth/Login/Login"));
const AssignCards = lazy(() => import("./Pages/Main/AssignCards/AssignCards"));
const Attendance = lazy(() => import("./Pages/Main/Attendance/Attendance"));
const AttendanceStatistics = lazy(
    () =>
        import(
            "./Pages/Main/Attendance/AttendanceStatistics/AttendanceStatistics"
        )
);
const CheckIn = lazy(() => import("./Pages/Main/CheckIn/CheckIn"));
const Competition = lazy(() => import("./Pages/Main/Competition/Competition"));
const Devices = lazy(() => import("./Pages/Main/Devices/Devices"));
const Home = lazy(() => import("./Pages/Main/Home/Home"));
const ImportCompetition = lazy(
    () => import("./Pages/Main/ImportCompetition/ImportCompetition")
);
const Incidents = lazy(
    () => import("./Pages/Main/Incidents/AllIncidents/Incidents")
);
const ResolvedIncidents = lazy(
    () => import("./Pages/Main/Incidents/ResolvedIncidents/ResolvedIncidents")
);
const NoteworthyIncidents = lazy(
    () =>
        import("./Pages/Main/Incidents/NoteworthyIncidents/NoteworthyIncidents")
);
const Warnings = lazy(() => import("./Pages/Main/Incidents/Warnings/Warnings"));
const Layout = lazy(() => import("./Pages/Main/Layout/Layout"));
const NotFound = lazy(() => import("./Pages/Main/NotFound/NotFound"));
const DoubleCheck = lazy(
    () => import("./Pages/Main/Results/DoubleCheck/DoubleCheck")
);
const ResultsChecks = lazy(
    () => import("./Pages/Main/Results/ResultsChecks/ResultsChecks")
);
const ScramblesAdmin = lazy(
    () => import("./Pages/Main/ScramblesAdmin/ScramblesAdmin")
);
const Settings = lazy(() => import("./Pages/Main/Settings/Settings"));
const UnofficialEvents = lazy(
    () => import("./Pages/Main/UnofficialEvents/UnofficialEvents")
);
const Users = lazy(() => import("./Pages/Main/Users/Users"));
const AllScrambles = lazy(
    () => import("./Pages/ScramblingDevice/AllScrambles/AllScrambles")
);
const ScramblingDeviceHome = lazy(
    () => import("./Pages/ScramblingDevice/Home/ScramblingDeviceHome")
);
const ScrambleSet = lazy(
    () => import("./Pages/ScramblingDevice/ScrambleSet/ScrambleSet")
);
const ScramblingDeviceLayout = lazy(
    () => import("./Pages/ScramblingDevice/ScramblingDeviceLayout")
);
const Persons = lazy(() => import("./Pages/Main/Persons/Persons"));
const Results = lazy(() => import("./Pages/Main/Results/Results"));
const PublicView = lazy(
    () => import("./Pages/Main/Results/PublicView/PublicView")
);
const SingleResult = lazy(
    () => import("./Pages/Main/Results/SingleResult/SingleResult")
);
const IncidentPage = lazy(
    () => import("./Pages/Main/Incidents/IncidentPage/IncidentPage")
);
const PersonResults = lazy(
    () => import("./Pages/Main/Persons/PersonResults/PersonResults")
);

const App = () => {
    const [isConnected, setConnected] = useState(0);

    const router = createBrowserRouter([
        {
            path: "/auth/login",
            element: <Login />,
        },
        {
            path: "/competition/import",
            element: <ImportCompetition />,
        },
        {
            path: "/",
            element: <Layout />,
            children: [
                {
                    path: "",
                    element: <Home />,
                },
                {
                    path: "users",
                    element: <Users />,
                },
                {
                    path: "competition",
                    element: <Competition />,
                },
                {
                    path: "incidents",
                    element: <Incidents />,
                },
                {
                    path: "incidents/resolved",
                    element: <ResolvedIncidents />,
                },
                {
                    path: "incidents/noteworthy",
                    element: <NoteworthyIncidents />,
                },
                {
                    path: "incidents/warnings",
                    element: <Warnings />,
                },
                {
                    path: "incidents/:id",
                    element: <IncidentPage />,
                },
                {
                    path: "persons",
                    element: <Persons />,
                },
                {
                    path: "persons/:id/results",
                    element: <PersonResults />,
                },
                {
                    path: "cards",
                    element: <AssignCards />,
                },
                {
                    path: "results",
                    element: <Results />,
                },
                {
                    path: "results/public",
                    element: <PublicView />,
                },
                {
                    path: "results/public/:id",
                    element: <PublicView />,
                },
                {
                    path: "results/round/:id",
                    element: <Results />,
                },
                {
                    path: "results/round/:id/double-check",
                    element: <DoubleCheck />,
                },
                {
                    path: "results/round",
                    element: <Results />,
                },
                {
                    path: "results/checks",
                    element: <ResultsChecks />,
                },
                {
                    path: "results/checks/:id",
                    element: <ResultsChecks />,
                },
                {
                    path: "results/:id",
                    element: <SingleResult />,
                },
                {
                    path: "settings",
                    element: <Settings />,
                },
                {
                    path: "devices",
                    element: <Devices />,
                },
                {
                    path: "scrambles",
                    element: <ScramblesAdmin />,
                },
                {
                    path: "attendance",
                    element: <Attendance />,
                },
                {
                    path: "attendance/statistics",
                    element: <AttendanceStatistics />,
                },
                {
                    path: "attendance/:id",
                    element: <Attendance />,
                },
                {
                    path: "check-in",
                    element: <CheckIn />,
                },
                {
                    path: "statistics",
                    element: <CompetitionStatistics showCharts />,
                },
                {
                    path: "events",
                    element: <UnofficialEvents />,
                },
            ],
        },
        {
            path: "/scrambling-device",
            element: <ScramblingDeviceLayout />,
            children: [
                {
                    path: "/scrambling-device",
                    element: <ScramblingDeviceHome />,
                },
                {
                    path: "/scrambling-device/set/:id",
                    element: <ScrambleSet />,
                },
                {
                    path: "/scrambling-device/set/:id/scrambles",
                    element: <AllScrambles />,
                },
            ],
        },
        {
            path: "*",
            element: <NotFound />,
        },
    ]);

    return (
        <ThemeProvider defaultTheme="dark" storageKey={THEME_STORAGE_KEY}>
            <ConfirmProvider>
                <SocketContext.Provider value={[isConnected, setConnected]}>
                    <RouterProvider router={router} />
                    <Toaster />
                </SocketContext.Provider>
            </ConfirmProvider>
        </ThemeProvider>
    );
};

export default App;
