import { Alert, AlertDescription, AlertTitle } from "@/Components/ui/alert";

interface ScrambleSetsValidatorsProps {
    warnings: string[];
    errors: string[];
}

const ScrambleSetsValidators = ({
    warnings: warningsList,
    errors: errorsList,
}: ScrambleSetsValidatorsProps) => {
    return (
        <>
            {errorsList.length > 0 && (
                <Alert variant="destructive">
                    <AlertTitle>Errors detected during import</AlertTitle>
                    <AlertDescription>
                        <ul className="list-disc pl-5">
                            {errorsList.map((error, i) => (
                                <li key={i}>{error}</li>
                            ))}
                        </ul>
                    </AlertDescription>
                </Alert>
            )}
            {warningsList.length > 0 && (
                <Alert>
                    <AlertTitle>Warnings detected during import</AlertTitle>
                    <AlertDescription>
                        <ul className="list-disc pl-5">
                            {warningsList.map((warning, i) => (
                                <li key={i}>{warning}</li>
                            ))}
                        </ul>
                    </AlertDescription>
                </Alert>
            )}
        </>
    );
};

export default ScrambleSetsValidators;
