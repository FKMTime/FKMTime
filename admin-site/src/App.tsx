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
import Stations from "./Pages/Stations/Stations";
import Tutorial from "./Pages/Tutorial/Tutorial";
import AssignCards from "./Pages/AssignCards/AssignCards";

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
          path: "persons",
          element: <Persons />,
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
          path: "results/:id",
          element: <SingleResult />,
        },
        {
          path: "settings",
          element: <Settings />,
        },
        {
          path: "stations",
          element: <Stations />,
        },
        {
          path: "tutorial",
          element: <Tutorial />,
        }
      ]
    }
  ]);

  return (
    <ChakraProvider>
      <RouterProvider router={router}></RouterProvider>
    </ChakraProvider>
  );
};

export default App;
