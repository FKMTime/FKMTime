import ReactDOM from "react-dom/client";
import "@cubing/icons";
import App from "./App.tsx";
import "./index.css";
import { ChakraProvider, extendTheme } from "@chakra-ui/react";

const theme = extendTheme({
    styles: {
        global: {
            body: {
                bg: "gray.700",
                color: "white",
            },
        },
    },
});

ReactDOM.createRoot(document.getElementById("root")!).render(
    <ChakraProvider theme={theme}>
        <App />
    </ChakraProvider>
);
