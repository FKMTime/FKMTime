// Re-exports the shared SelectCompetitor with DoubleCheck-specific prop mapping
import { Person, ResultToDoubleCheck } from "@/lib/interfaces";

import SharedSelectCompetitor from "../../Components/SelectCompetitor";

interface SelectCompetitorProps {
    idInputRef: React.RefObject<HTMLInputElement>;
    handleSubmit: () => void;
    resultsToDoubleCheck: ResultToDoubleCheck[];
    setResult: (result: ResultToDoubleCheck | null) => void;
    inputValue: string;
    setInputValue: (value: string) => void;
    setJustSelected: (value: boolean) => void;
}

const SelectCompetitor = ({
    idInputRef,
    handleSubmit,
    resultsToDoubleCheck,
    setResult,
    inputValue,
    setInputValue,
    setJustSelected,
}: SelectCompetitorProps) => {
    const handleSelect = (person: Person | null) => {
        if (!person) {
            setResult(null);
            return;
        }
        const selectedResult = resultsToDoubleCheck.find(
            (r) => r.person.registrantId === person.registrantId
        );
        setResult(selectedResult || null);
    };

    return (
        <SharedSelectCompetitor
            idInputRef={idInputRef}
            handleSubmit={handleSubmit}
            persons={resultsToDoubleCheck.map((r) => r.person)}
            onSelect={handleSelect}
            inputValue={inputValue}
            setInputValue={setInputValue}
            setJustSelected={setJustSelected}
        />
    );
};

export default SelectCompetitor;
