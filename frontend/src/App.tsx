import { useState } from "react";
import React from "react";
import { createBrowserRouter, RouterProvider } from "react-router-dom";

import Layout from "./Layout/Layout";
import AssignCards from "./Pages/AssignCards/AssignCards";
import Attendance from "./Pages/Attendance/Attendance";
import AttendanceStatistics from "./Pages/Attendance/AttendanceStatistics/AttendanceStatistics";
import Login from "./Pages/Auth/Login/Login";
import CheckIn from "./Pages/CheckIn/CheckIn";
import Competition from "./Pages/Competition/Competition";
import Rooms from "./Pages/Competition/Tabs/Rooms";
import Devices from "./Pages/Devices/Devices";
import Home from "./Pages/Home/Home";
import ImportCompetition from "./Pages/ImportCompetition/ImportCompetition";
import Incidents from "./Pages/Incidents/AllIncidents/Incidents";
import NotFound from "./Pages/NotFound/NotFound";
import ResolvedIncidents from "./Pages/ResolvedIncidents/ResolvedIncidents";
import DoubleCheck from "./Pages/Results/DoubleCheck/DoubleCheck";
import PublicView from "./Pages/Results/PublicView/PublicView";
import ResultsChecks from "./Pages/Results/ResultsChecks/ResultsChecks";
import Settings from "./Pages/Settings/Settings";
import Users from "./Pages/Users/Users";
import { SocketContext } from "./socket";
const Persons = React.lazy(() => import("./Pages/Persons/Persons"));
const Results = React.lazy(() => import("./Pages/Results/Results"));
const SingleResult = React.lazy(
    () => import("./Pages/Results/SingleResult/SingleResult")
);
const IncidentPage = React.lazy(
    () => import("./Pages/Incidents/IncidentPage/IncidentPage")
);
const PersonResults = React.lazy(
    () => import("./Pages/Persons/PersonResults/PersonResults")
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
                    path: "rooms",
                    element: <Rooms />,
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
            ],
        },
        {
            path: "*",
            element: <NotFound />,
        },
    ]);

    return (
        <SocketContext.Provider value={[isConnected, setConnected]}>
            <RouterProvider router={router} />
        </SocketContext.Provider>
    );
};

export default App;
