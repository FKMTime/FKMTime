import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { H2hExportChecks } from "@/lib/h2h";

import WcaExportPanel from "./WcaExportPanel";

const state = vi.hoisted(() => ({
    checks: undefined as H2hExportChecks | undefined,
    updatedAt: 1,
}));
const { downloadH2hCsv, refetch, toast } = vi.hoisted(() => ({
    downloadH2hCsv: vi.fn(),
    refetch: vi.fn(),
    toast: vi.fn(),
}));

vi.mock("@/hooks/useLiveQuery", () => ({
    useLiveQuery: () => ({
        data: state.checks,
        dataUpdatedAt: state.updatedAt,
        isError: false,
        refetch,
    }),
}));
vi.mock("@/hooks/useToast", () => ({ useToast: () => ({ toast }) }));
vi.mock("@/lib/h2h", async (importOriginal) => ({
    ...(await importOriginal<object>()),
    downloadH2hCsv,
}));

const ready: H2hExportChecks = {
    fileName: "ExampleOpen2026-333oh-r2-h2h.csv",
    wcaRoundId: 98765,
    blockers: [],
};

const askForPassword = () => {
    fireEvent.click(
        screen.getByRole("button", { name: "Download results for WCA (CSV)" })
    );
    fireEvent.change(screen.getByLabelText("Password"), {
        target: { value: "secret" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Download" }));
};

describe("WcaExportPanel", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        state.checks = ready;
        state.updatedAt = 1;
    });

    it("lists what blocks the file instead of asking for the password", () => {
        state.checks = {
            ...ready,
            blockers: [
                "Semifinal 1, set 2, point 3 has an open incident. Resolve it first.",
                "The WCA round id couldn't be fetched from the WCA website. Enter it on the Bracket tab.",
            ],
        };
        render(<WcaExportPanel roundId="333oh-r2" />);

        expect(screen.getByRole("alert").textContent).toContain(
            "Semifinal 1, set 2, point 3 has an open incident"
        );
        expect(screen.getByRole("alert").textContent).toContain(
            "Enter it on the Bracket tab"
        );
        expect(
            screen.queryByRole("button", {
                name: "Download results for WCA (CSV)",
            })
        ).toBeNull();
        fireEvent.click(screen.getByRole("button", { name: "Check again" }));
        expect(refetch).toHaveBeenCalled();
    });

    it("asks for the scramble password, then downloads", async () => {
        downloadH2hCsv.mockResolvedValue({ ok: true });
        render(<WcaExportPanel roundId="333oh-r2" />);

        askForPassword();

        await waitFor(() =>
            expect(toast).toHaveBeenCalledWith(
                expect.objectContaining({ title: "Results downloaded" })
            )
        );
        expect(downloadH2hCsv).toHaveBeenCalledWith("333oh-r2", "secret");
        expect(screen.queryByLabelText("Password")).toBeNull();
    });

    it("keeps the form open with the error on a wrong password", async () => {
        downloadH2hCsv.mockResolvedValue({
            ok: false,
            wrongPassword: true,
            message: "Wrong password. Use the password of the scramble sets.",
        });
        render(<WcaExportPanel roundId="333oh-r2" />);

        askForPassword();

        expect(
            await screen.findByText(
                "Wrong password. Use the password of the scramble sets."
            )
        ).toBeTruthy();
        expect(screen.getByLabelText("Password")).toBeTruthy();
    });

    it("shows what the download found blocking", async () => {
        downloadH2hCsv.mockResolvedValue({
            ok: false,
            blockers: ["Final isn't finished"],
            message: "Fix these first, then download again.",
        });
        render(<WcaExportPanel roundId="333oh-r2" />);

        askForPassword();

        expect((await screen.findByRole("alert")).textContent).toContain(
            "Final isn't finished"
        );
        expect(refetch).toHaveBeenCalled();
    });

    it("drops what the download found once the checks come back clean", async () => {
        downloadH2hCsv.mockResolvedValue({
            ok: false,
            blockers: ["Final isn't finished"],
            message: "Fix these first, then download again.",
        });
        const { rerender } = render(<WcaExportPanel roundId="333oh-r2" />);
        askForPassword();
        await screen.findByRole("alert");

        // The refetch brings checks with nothing left to fix
        state.updatedAt = 2;
        rerender(<WcaExportPanel roundId="333oh-r2" />);

        expect(screen.queryByRole("alert")).toBeNull();
        expect(
            screen.getByRole("button", {
                name: "Download results for WCA (CSV)",
            })
        ).toBeTruthy();
    });
});
