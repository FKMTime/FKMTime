import { ChakraProvider, createSystem, defineConfig } from "@chakra-ui/react";

import { ColorModeProvider } from "./color-mode";

const config = defineConfig({
    theme: {
        semanticTokens: {
            colors: {
                bg: {
                    DEFAULT: { value: "{colors.gray.700}" },
                },
                text: {
                    DEFAULT: { value: "{colors.white}" },
                },
            },
        },
    },
});

const system = createSystem(config);

export function Provider(props: React.PropsWithChildren) {
    return (
        <ChakraProvider value={system}>
            <ColorModeProvider>{props.children}</ColorModeProvider>
        </ChakraProvider>
    );
}
