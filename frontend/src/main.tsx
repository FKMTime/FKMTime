import "@cubing/icons";
import "@fontsource/public-sans/400.css";
import "@fontsource/public-sans/500.css";
import "@fontsource/public-sans/600.css";
import "@fontsource/public-sans/700.css";
import "@fontsource/jetbrains-mono/400.css";
import "@fontsource/jetbrains-mono/500.css";
import "flag-icons/css/flag-icons.min.css";
import "./index.css";

import ReactDOM from "react-dom/client";

import App from "./App";

// React 19 reads intrinsic elements from React.JSX, not the global JSX
declare module "react" {
    namespace JSX {
        interface IntrinsicElements {
            //eslint-disable-next-line @typescript-eslint/no-explicit-any
            "scramble-display": any;
        }
    }
}

ReactDOM.createRoot(document.getElementById("root")!).render(<App />);
