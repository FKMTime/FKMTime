import {
    ChakraProvider,
    createSystem,
    defaultConfig,
    defineConfig,
} from "@chakra-ui/react";

import { ColorModeProvider } from "./color-mode";

const config = defineConfig({
    globalCss: {
        html: {
            colorPalette: "teal",
            fontFamily: "Geist",
            borderRadius: "sm",
        },
    },
});

const system = createSystem(defaultConfig, config);
export function Provider(props: React.PropsWithChildren) {
    return (
        <ChakraProvider value={system}>
            <ColorModeProvider>{props.children}</ColorModeProvider>
        </ChakraProvider>
    );
}
