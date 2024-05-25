import { createBrowserRouter, RouterProvider } from "react-router-dom";

import AttendanceStatistics from "@/Pages/Attendance/AttendanceStatistics/AttendanceStatistics.tsx";
import CheckIn from "@/Pages/CheckIn/CheckIn.tsx";
import ImportCompetition from "@/Pages/ImportCompetition/ImportCompetition.tsx";
import ResolvedIncidents from "@/Pages/ResolvedIncidents/ResolvedIncidents.tsx";

import Layout from "./Layout/Layout";
import Accounts from "./Pages/Accounts/Accounts";
import AssignCards from "./Pages/AssignCards/AssignCards";
import Attendance from "./Pages/Attendance/Attendance";
import Login from "./Pages/Auth/Login/Login";
import Competition from "./Pages/Competition/Competition";
import Devices from "./Pages/Devices/Devices";
import Home from "./Pages/Home/Home";
import IncidentPage from "./Pages/Incidents/IncidentPage";
import Incidents from "./Pages/Incidents/Incidents";
import NotFound from "./Pages/NotFound/NotFound";
import PersonResults from "./Pages/Persons/PersonResults/PersonResults";
import Persons from "./Pages/Persons/Persons";
import Results from "./Pages/Results/Results";
import SingleResult from "./Pages/Results/SingleResult/SingleResult";
import Rooms from "./Pages/Rooms/Rooms";
import Settings from "./Pages/Settings/Settings";

const App = () => {
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
                    path: "accounts",
                    element: <Accounts />,
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
                    path: "results/round/:id",
                    element: <Results />,
                },
                {
                    path: "results/round",
                    element: <Results />,
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

    return <RouterProvider router={router} />;
};

export default App;
