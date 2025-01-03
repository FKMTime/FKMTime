import { Alert, AlertIcon, Box, Button, useToast } from "@chakra-ui/react";
import { Competition as WCIF } from "@wca/helpers";
import { useAtomValue } from "jotai";
import { useState } from "react";

import { competitionAtom } from "@/logic/atoms";
import { importScrambles, validateScrambles } from "@/logic/scramblesImport";

import ScrambleSetsList from "./Components/ScrambleSetsList";
import ScrambleSetsWarnings from "./Components/ScrambleSetsValidators";

const ImportScrambles = () => {
    const toast = useToast();
    const [wcif, setWcif] = useState<WCIF>();
    const [fileInputKey, setFileInputKey] = useState(0);
    const [preventFromImporting, setPreventFromImporting] = useState(false);
    const competition = useAtomValue(competitionAtom);
    const [warningsList, setWarningsList] = useState<string[]>([]);
    const [errorsList, setErrorsList] = useState<string[]>([]);

    const handleFileUpload = () => {
        clearUploadedScrambles(false);
        const file = document.querySelector("input")?.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = () => {
                const result = reader.result as string;
                const parsedWCIF = JSON.parse(result).wcif;
                if (!parsedWCIF || !competition) return;
                const { warnings, errors } = validateScrambles(
                    parsedWCIF,
                    competition?.wcif
                );
                setWarningsList(warnings);
                setErrorsList(errors);
                if (errors.length > 0) {
                    setPreventFromImporting(true);
                }
                setWcif(JSON.parse(result).wcif);
            };
            reader.readAsText(file);
        }
    };

    const handleImport = async () => {
        if (!wcif || !competition) return;
        const response = await importScrambles(wcif);
        if (response.status === 201) {
            toast({
                title: "Scrambles imported",
                status: "success",
            });
            clearUploadedScrambles();
        } else {
            toast({
                title: "Error",
                description: "Something went wrong",
                status: "error",
            });
            toast({
                title: "Error",
                description: response.data.message,
                status: "error",
            });
        }
    };

    const clearUploadedScrambles = (clearInput = true) => {
        setWcif(undefined);
        if (clearInput) setFileInputKey((prev) => prev + 1);
        setPreventFromImporting(false);
    };

    return (
        <Box display="flex" flexDirection="column" gap="3">
            <Alert status="info" color="black">
                <AlertIcon />
                Use this page only for importing scrambles for the round that
                doesn't have them yet. If you want to add an extra scramble/set
                please do it in the Scramble Sets tab.
            </Alert>
            <input type="file" onChange={handleFileUpload} key={fileInputKey} />
            {wcif && competition && (
                <ScrambleSetsWarnings
                    warnings={warningsList}
                    errors={errorsList}
                />
            )}
            {wcif && <ScrambleSetsList wcif={wcif} />}
            {wcif && competition && (
                <Box display="flex" gap="3">
                    <Button
                        colorPalette="red"
                        onClick={() => clearUploadedScrambles()}
                        width={{ base: "100%", md: "fit-content" }}
                    >
                        Clear
                    </Button>
                    <Button
                        isDisabled={preventFromImporting}
                        colorPalette="green"
                        onClick={handleImport}
                        width={{ base: "100%", md: "fit-content" }}
                    >
                        Import
                    </Button>
                </Box>
            )}
        </Box>
    );
};

export default ImportScrambles;
