import { Competition as WCIF } from "@wca/helpers";
import { useAtomValue } from "jotai";
import { FileUp } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router-dom";

import { Button } from "@/Components/ui/button";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/Components/ui/card";
import { Input } from "@/Components/ui/input";
import { useToast } from "@/hooks/useToast";
import { competitionAtom } from "@/lib/atoms";
import {
    importScrambles,
    removeUnusedScramblesFromWcif,
    validateScrambles,
} from "@/lib/scramblesImport";
import PageTransition from "@/Pages/PageTransition";

import ScrambleSetsList from "./Components/ScrambleSetsList";
import ScrambleSetsWarnings from "./Components/ScrambleSetsValidators";

const ImportScrambles = () => {
    const { toast } = useToast();
    const [wcif, setWcif] = useState<WCIF>();
    const [fileInputKey, setFileInputKey] = useState(0);
    const [preventFromImporting, setPreventFromImporting] = useState(false);
    const competition = useAtomValue(competitionAtom);
    const [warningsList, setWarningsList] = useState<string[]>([]);
    const [errorsList, setErrorsList] = useState<string[]>([]);

    const handleFileUpload = () => {
        if (!competition) return;
        clearUploadedScrambles(false);
        const file = document.querySelector("input")?.files?.[0];
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
        if (clearInput) setFileInputKey((prev) => prev + 1);
        setPreventFromImporting(false);
    };

    return (
        <PageTransition>
            <div className="flex flex-col gap-4">
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <FileUp size={20} />
                            Import scrambles
                        </CardTitle>
                        <CardDescription>
                            Use this page only for importing scrambles for the
                            round that doesn't have them yet. If you want to add
                            an extra scramble/set please do it in the Scramble
                            Sets tab. If you generated scrambles for unofficial
                            events please remember to add them first in the {""}
                            <Link
                                to="/events"
                                className="text-blue-500
                            "
                            >
                                Unofficial Events
                            </Link>{" "}
                            tab.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="flex flex-col gap-4">
                        <div className="w-fit flex flex-col gap-3">
                            <label>Upload encrypted scrambles JSON</label>
                            <Input
                                type="file"
                                accept=".json"
                                onChange={handleFileUpload}
                                key={fileInputKey}
                            />
                        </div>
                        {wcif && competition && (
                            <ScrambleSetsWarnings
                                warnings={warningsList}
                                errors={errorsList}
                            />
                        )}
                        {wcif && competition && (
                            <div className="flex gap-3">
                                <Button
                                    variant="destructive"
                                    onClick={() => clearUploadedScrambles()}
                                >
                                    Clear
                                </Button>
                                <Button
                                    disabled={preventFromImporting}
                                    variant="success"
                                    onClick={handleImport}
                                >
                                    Import
                                </Button>
                            </div>
                        )}
                    </CardContent>
                </Card>
                {wcif && <ScrambleSetsList wcif={wcif} />}
            </div>
        </PageTransition>
    );
};

export default ImportScrambles;
