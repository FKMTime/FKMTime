import { fireEvent, render, screen } from "@testing-library/react";
import { useRef, useState } from "react";
import { describe, expect, it, vi } from "vitest";

import { Person } from "@/lib/interfaces";

import SelectCompetitor from "./SelectCompetitor";

const persons = [
    { id: "uuid-1", registrantId: 1, name: "Alex Example" },
    { id: "uuid-3", registrantId: 3, name: "Casey Tester" },
] as Person[];

const Harness = ({ onSelect }: { onSelect: (p: Person | null) => void }) => {
    const idInputRef = useRef<HTMLInputElement>(null);
    const [inputValue, setInputValue] = useState("");
    return (
        <SelectCompetitor
            idInputRef={idInputRef}
            handleSubmit={vi.fn()}
            persons={persons}
            onSelect={onSelect}
            inputValue={inputValue}
            setInputValue={setInputValue}
        />
    );
};

describe("SelectCompetitor", () => {
    it("shows the competitor's name once their ID is typed", () => {
        const onSelect = vi.fn();
        render(<Harness onSelect={onSelect} />);
        const nameBox = () => screen.getByRole("combobox");
        expect(nameBox().textContent).toBe("Select person...");

        fireEvent.change(screen.getByPlaceholderText("ID"), {
            target: { value: "3" },
        });
        expect(onSelect).toHaveBeenLastCalledWith(persons[1]);
        expect(nameBox().textContent).toBe("Casey Tester");

        fireEvent.change(screen.getByPlaceholderText("ID"), {
            target: { value: "9" },
        });
        expect(nameBox().textContent).toBe("Select person...");
    });
});
