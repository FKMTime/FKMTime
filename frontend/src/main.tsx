import "@cubing/icons";
import "./index.css";

import ReactDOM from "react-dom/client";

import App from "./App";

declare global {
    namespace JSX {
        interface IntrinsicElements {
            //eslint-disable-next-line @typescript-eslint/no-explicit-any
            "scramble-display": any;
        }
    }
}

ReactDOM.createRoot(document.getElementById("root")!).render(<App />);
