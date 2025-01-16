import "@cubing/icons";
import "./index.css";

import ReactDOM from "react-dom/client";

import App from "./App";
import { Toaster } from "./Components/ui/toaster";
import { ThemeProvider } from "./providers/ThemeProvider";
import { THEME_STORAGE_KEY } from "./lib/constants";

declare global {
    namespace JSX {
        interface IntrinsicElements {
            //eslint-disable-next-line @typescript-eslint/no-explicit-any
            "scramble-display": any;
        }
    }
}

ReactDOM.createRoot(document.getElementById("root")!).render(<App />);
