import { Person, ResultToDoubleCheck } from "@/lib/interfaces";

import SharedSelectCompetitor from "../../Components/SelectCompetitor";

interface CheckedResult {
    id: string;
    person: Person;
}

interface SelectCompetitorProps {
    idInputRef: React.RefObject<HTMLInputElement>;
    handleSubmit: () => void;
    resultsToDoubleCheck: ResultToDoubleCheck[];
    checkedResults: CheckedResult[];
    setResult: (result: ResultToDoubleCheck | null) => void;
    setAlreadyCheckedResult: (result: CheckedResult | null) => void;
    inputValue: string;
    setInputValue: (value: string) => void;
    setJustSelected: (value: boolean) => void;
}

const SelectCompetitor = ({
    idInputRef,
    handleSubmit,
    resultsToDoubleCheck,
    checkedResults,
    setResult,
    setAlreadyCheckedResult,
    inputValue,
    setInputValue,
    setJustSelected,
}: SelectCompetitorProps) => {
    const handleSelect = (person: Person | null) => {
        if (!person) {
            setResult(null);
            setAlreadyCheckedResult(null);
            return;
        }
        const selectedResult = resultsToDoubleCheck.find(
            (r) => r.person.registrantId === person.registrantId
        );
        if (selectedResult) {
            setResult(selectedResult);
            setAlreadyCheckedResult(null);
        } else {
            const checked = checkedResults.find(
                (r) => r.person.registrantId === person.registrantId
            );
            setResult(null);
            setAlreadyCheckedResult(checked ?? null);
        }
    };

    return (
        <SharedSelectCompetitor
            idInputRef={idInputRef}
            handleSubmit={handleSubmit}
            persons={[
                ...resultsToDoubleCheck.map((r) => r.person),
                ...checkedResults.map((r) => r.person),
            ]}
            onSelect={handleSelect}
            inputValue={inputValue}
            setInputValue={setInputValue}
            setJustSelected={setJustSelected}
        />
    );
};

export default SelectCompetitor;
