import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { Person } from "@/lib/interfaces";
import {
    checkedInCount,
    checkIn,
    getPersonInfoByCardIdWithSensitiveData,
    undoCheckIn,
} from "@/lib/persons";

import CheckIn from "./CheckIn";
import CheckInPanel from "./Components/CheckInPanel";

vi.mock("@/lib/persons", () => ({
    checkedInCount: vi.fn(),
    checkIn: vi.fn(),
    getPersonInfoByCardIdWithSensitiveData: vi.fn(),
    getPersons: vi.fn().mockResolvedValue({ data: [] }),
    undoCheckIn: vi.fn(),
}));
vi.mock("@/hooks/useToast", () => ({ useToast: () => ({ toast: vi.fn() }) }));
const showUndo = vi.fn();
vi.mock("@/hooks/useUndoToast", () => ({ useUndoToast: () => showUndo }));

const newcomer = {
    id: "p1",
    registrantId: 7,
    name: "Anna Example",
    countryIso2: "PL",
    canCompete: true,
    gender: "f",
} as Person;

describe("CheckInPanel", () => {
    it("requires a card and every newcomer check before checking in", async () => {
        const onCheckIn = vi.fn();
        render(
            <CheckInPanel
                person={newcomer}
                error=""
                isLoading={false}
                onCheckIn={onCheckIn}
                onCancel={vi.fn()}
            />
        );
        const submit = screen.getByRole("button", {
            name: "Check in and assign card",
        });
        expect((submit as HTMLButtonElement).disabled).toBe(true);

        await userEvent.type(screen.getByLabelText(/Scan a card/), "0004");
        expect((submit as HTMLButtonElement).disabled).toBe(true);

        for (const checkbox of screen.getAllByRole("checkbox"))
            await userEvent.click(checkbox);
        expect(screen.getAllByRole("checkbox")).toHaveLength(3);
        await userEvent.click(submit);
        expect(onCheckIn).toHaveBeenCalledWith("0004");
    });

    it("checks in a competitor who already has a card straight away", async () => {
        const onCheckIn = vi.fn();
        render(
            <CheckInPanel
                person={{ ...newcomer, wcaId: "2019EXAM01", cardId: "0009" }}
                error=""
                isLoading={false}
                onCheckIn={onCheckIn}
                onCancel={vi.fn()}
            />
        );
        expect(screen.queryByRole("checkbox")).toBeNull();
        await userEvent.click(screen.getByRole("button", { name: "Check in" }));
        expect(onCheckIn).toHaveBeenCalledWith("0009");
    });
});

describe("CheckIn", () => {
    beforeEach(() => {
        vi.mocked(checkedInCount).mockResolvedValue({
            checkedInPersonsCount: 16,
            totalPersonsCount: 18,
        });
    });

    it("shows card scan problems inline", async () => {
        vi.mocked(getPersonInfoByCardIdWithSensitiveData)
            .mockResolvedValueOnce({ status: 404, data: null })
            .mockResolvedValueOnce({
                status: 200,
                data: { ...newcomer, checkedInAt: new Date() },
            });
        render(<CheckIn />);
        const scan = await screen.findByLabelText("Scan the competitor's card");
        expect(screen.getByText("2 to go")).toBeTruthy();

        await userEvent.type(scan, "1111{Enter}");
        expect((await screen.findByRole("alert")).textContent).toBe(
            "This card is not assigned to anyone."
        );

        await userEvent.type(scan, "2222{Enter}");
        expect((await screen.findByRole("alert")).textContent).toBe(
            "Anna Example is already checked in."
        );
    });

    it("checks in a scanned competitor and lists them as just checked in", async () => {
        vi.mocked(getPersonInfoByCardIdWithSensitiveData).mockResolvedValue({
            status: 200,
            data: { ...newcomer, wcaId: "2019EXAM01", cardId: "0009" },
        });
        vi.mocked(checkIn).mockResolvedValue({ status: 200, data: {} });
        render(<CheckIn />);
        await userEvent.type(
            await screen.findByLabelText("Scan the competitor's card"),
            "0009{Enter}"
        );
        await userEvent.click(
            await screen.findByRole("button", { name: "Check in" })
        );
        expect(checkIn).toHaveBeenCalledWith("p1", "0009");
        expect(await screen.findByText("Just checked in")).toBeTruthy();
    });

    it("undoes a check-in from the toast, keeping a card they already had", async () => {
        vi.mocked(getPersonInfoByCardIdWithSensitiveData).mockResolvedValue({
            status: 200,
            data: { ...newcomer, wcaId: "2019EXAM01", cardId: "0009" },
        });
        vi.mocked(checkIn).mockResolvedValue({ status: 200, data: {} });
        vi.mocked(undoCheckIn).mockResolvedValue(204);
        showUndo.mockClear();
        render(<CheckIn />);
        await userEvent.type(
            await screen.findByLabelText("Scan the competitor's card"),
            "0009{Enter}"
        );
        await userEvent.click(
            await screen.findByRole("button", { name: "Check in" })
        );
        await screen.findByText("Just checked in");
        expect(showUndo).toHaveBeenCalledWith(
            expect.objectContaining({ title: "Anna Example checked in" })
        );

        await act(() => showUndo.mock.calls[0][0].onUndo());
        expect(undoCheckIn).toHaveBeenCalledWith("p1", false);
        expect(screen.queryByText("Just checked in")).toBeNull();
    });
});
