import { RouterProvider, createBrowserRouter } from "react-router-dom";
import { ChakraProvider } from "@chakra-ui/react";
import Login from "./Pages/Auth/Login/Login";
import Layout from "./Layout/Layout";
import Home from "./Pages/Home/Home";
import Accounts from "./Pages/Accounts/Accounts";
import Competition from "./Pages/Competition/Competition";
import Persons from "./Pages/Persons/Persons";
import Results from "./Pages/Results/Results";
import SingleResult from "./Pages/Results/SingleResult";
import Settings from "./Pages/Settings/Settings";
import Devices from "./Pages/Devices/Devices.tsx";
import Tutorial from "./Pages/Tutorial/Tutorial";
import AssignCards from "./Pages/AssignCards/AssignCards";
import Giftpacks from "./Pages/Giftpacks/GIftpacks.tsx";
import PersonResults from "./Pages/Persons/PersonResults.tsx";
import Rooms from "./Pages/Rooms/Rooms.tsx";
import Attendance from "./Pages/Attendance/Attendance.tsx";
import Incidents from "./Pages/Incidents/Incidents.tsx";
import IncidentPage from "./Pages/Incidents/IncidentPage.tsx";
import NotFound from "./Pages/NotFound/NotFound.tsx";

const App = (): JSX.Element => {
    const router = createBrowserRouter([
        {
            path: "/auth/login",
            element: <Login />,
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
                    path: "attendance/:id",
                    element: <Attendance />,
                },
                {
                    path: "tutorial",
                    element: <Tutorial />,
                },
                {
                    path: "giftpacks",
                    element: <Giftpacks />,
                },
            ],
        },
        {
            path: "*",
            element: <NotFound />,
        }
    ]);

    return (
        <ChakraProvider>
            <RouterProvider router={router}></RouterProvider>
        </ChakraProvider>
    );
};

export default App;
