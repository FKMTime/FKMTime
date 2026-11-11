import { useAtomValue } from "jotai";
import { Download } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router-dom";
import { Competition as WCIF } from "wcif-helpers";

import FileDropzone from "@/Components/shared/FileDropzone";
import { Button } from "@/Components/ui/button";
import { useToast } from "@/hooks/useToast";
import { competitionAtom } from "@/lib/atoms";
import {
    importScrambles,
    removeUnusedScramblesFromWcif,
    validateScrambles,
} from "@/lib/scramblesImport";

import ScrambleSetsList from "./Components/ScrambleSetsList";
import ScrambleSetsWarnings from "./Components/ScrambleSetsValidators";

const ImportScrambles = () => {
    const { toast } = useToast();
    const [wcif, setWcif] = useState<WCIF>();
    // Remounts the dropzone so Clear also resets the picked file
    const [dropzoneKey, setDropzoneKey] = useState(0);
    const [preventFromImporting, setPreventFromImporting] = useState(false);
    const competition = useAtomValue(competitionAtom);
    const [warningsList, setWarningsList] = useState<string[]>([]);
    const [errorsList, setErrorsList] = useState<string[]>([]);

    const handleFileChange = (file: File | null) => {
        if (!competition) return;
        clearUploadedScrambles(false);
        if (file) {
            const reader = new FileReader();
            reader.onload = () => {
                const result = reader.result as string;
                const parsedWCIF = removeUnusedScramblesFromWcif(
                    JSON.parse(result).wcif,
                    competition.wcif
                );

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
                setWcif(parsedWCIF);
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
                variant: "success",
            });
            clearUploadedScrambles();
        } else {
            toast({
                title: "Error",
                description: "Something went wrong",
                variant: "destructive",
            });
            toast({
                title: "Error",
                description: response.data.message,
                variant: "destructive",
            });
        }
    };

    const clearUploadedScrambles = (clearInput = true) => {
        setWcif(undefined);
        if (clearInput) setDropzoneKey((prev) => prev + 1);
        setPreventFromImporting(false);
    };

    return (
        <>
            <div className="rounded-mobile-card border bg-card p-4 md:rounded-2xl md:p-6">
                <div className="flex max-w-[560px] flex-col gap-4">
                    <div className="flex flex-col gap-1.5 text-sm text-muted-foreground">
                        <p>
                            Upload the encrypted scrambles JSON exported from
                            TNoodle.
                        </p>
                        <p className="text-[13px]">
                            Only import rounds that have no scrambles yet; add
                            an extra scramble or set in Scramble sets. For
                            unofficial events, add the event in{" "}
                            <Link
                                to="/events"
                                className="text-primary hover:underline"
                            >
                                Unofficial events
                            </Link>{" "}
                            first.
                        </p>
                    </div>
                    <FileDropzone
                        key={dropzoneKey}
                        title="Upload encrypted scrambles JSON"
                        accept=".json"
                        onFileChange={handleFileChange}
                        className="py-8 md:rounded-xl"
                    />
                    {wcif && (
                        <ScrambleSetsWarnings
                            warnings={warningsList}
                            errors={errorsList}
                        />
                    )}
                    <div className="flex gap-2">
                        <Button
                            disabled={!wcif || preventFromImporting}
                            onClick={handleImport}
                            className="max-md:flex-1"
                        >
                            <Download />
                            Import
                        </Button>
                        {wcif && (
                            <Button
                                variant="ghost"
                                onClick={() => clearUploadedScrambles()}
                            >
                                Clear
                            </Button>
                        )}
                    </div>
                </div>
            </div>
            {wcif && <ScrambleSetsList wcif={wcif} />}
        </>
    );
};

export default ImportScrambles;
