import "@cubing/icons";
import "./index.css";

import { ChakraProvider, extendTheme } from "@chakra-ui/react";
import ReactDOM from "react-dom/client";

import App from "./App";
import { ConfirmProvider } from "chakra-ui-confirm";

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

declare global {
    namespace JSX {
        interface IntrinsicElements {
            //eslint-disable-next-line @typescript-eslint/no-explicit-any
            "scramble-display": any;
        }
    }
}

ReactDOM.createRoot(document.getElementById("root")!).render(
    <ChakraProvider
        theme={theme}
        resetCSS
        toastOptions={{
            defaultOptions: {
                duration: 3500,
                isClosable: true,
            },
        }}
    >
        <ConfirmProvider>
            <App />
        </ConfirmProvider>
    </ChakraProvider>
);
