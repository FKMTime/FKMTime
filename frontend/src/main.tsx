import "@cubing/icons";
import "./index.css";

import ReactDOM from "react-dom/client";

import App from "./App";
import { ConfirmProvider } from "chakra-ui-confirm";
import { Provider } from "./Components/ui/provider";

ReactDOM.createRoot(document.getElementById("root")!).render(
    <Provider>
        <ConfirmProvider>
            <App />
        </ConfirmProvider>
    </Provider>
);
