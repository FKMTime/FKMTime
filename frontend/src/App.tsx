import { useState } from "react";
import React from "react";
import { createBrowserRouter, RouterProvider } from "react-router-dom";

import { Toaster } from "@/Components/ui/toaster";
import { ConfirmProvider } from "@/providers/ConfirmProvider";
import { ThemeProvider } from "@/providers/ThemeProvider";

import CompetitionStatistics from "./Components/CompetitionStatistics/CompetitionStatistics";
import { THEME_STORAGE_KEY } from "./lib/constants";
import Login from "./Pages/Auth/Login/Login";
import AssignCards from "./Pages/Main/AssignCards/AssignCards";
import Attendance from "./Pages/Main/Attendance/Attendance";
import AttendanceStatistics from "./Pages/Main/Attendance/AttendanceStatistics/AttendanceStatistics";
import CheckIn from "./Pages/Main/CheckIn/CheckIn";
import Competition from "./Pages/Main/Competition/Competition";
import Devices from "./Pages/Main/Devices/Devices";
import Home from "./Pages/Main/Home/Home";
import ImportCompetition from "./Pages/Main/ImportCompetition/ImportCompetition";
import Incidents from "./Pages/Main/Incidents/AllIncidents/Incidents";
import ResolvedIncidents from "./Pages/Main/Incidents/ResolvedIncidents/ResolvedIncidents";
import Layout from "./Pages/Main/Layout/Layout";
import NotFound from "./Pages/Main/NotFound/NotFound";
import DoubleCheck from "./Pages/Main/Results/DoubleCheck/DoubleCheck";
import ResultsChecks from "./Pages/Main/Results/ResultsChecks/ResultsChecks";
import ScramblesAdmin from "./Pages/Main/ScramblesAdmin/ScramblesAdmin";
import Settings from "./Pages/Main/Settings/Settings";
import UnofficialEvents from "./Pages/Main/UnofficialEvents/UnofficialEvents";
import Users from "./Pages/Main/Users/Users";
import AllScrambles from "./Pages/ScramblingDevice/AllScrambles/AllScrambles";
import ScramblingDeviceHome from "./Pages/ScramblingDevice/Home/ScramblingDeviceHome";
import ScrambleSet from "./Pages/ScramblingDevice/ScrambleSet/ScrambleSet";
import ScramblingDeviceLayout from "./Pages/ScramblingDevice/ScramblingDeviceLayout";
import { SocketContext } from "./socket";
const Persons = React.lazy(() => import("./Pages/Main/Persons/Persons"));
const Results = React.lazy(() => import("./Pages/Main/Results/Results"));
const PublicView = React.lazy(
    () => import("./Pages/Main/Results/PublicView/PublicView")
);
const SingleResult = React.lazy(
    () => import("./Pages/Main/Results/SingleResult/SingleResult")
);
const IncidentPage = React.lazy(
    () => import("./Pages/Main/Incidents/IncidentPage/IncidentPage")
);
const PersonResults = React.lazy(
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
