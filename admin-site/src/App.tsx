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
