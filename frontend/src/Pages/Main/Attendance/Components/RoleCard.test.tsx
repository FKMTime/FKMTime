import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Gavel, Users } from "lucide-react";
import { describe, expect, it, vi } from "vitest";

import { StaffActivity, StaffActivityStatus } from "@/lib/interfaces";

import RoleCard from "./RoleCard";

vi.mock("./AddNotAssignedPersonModal", () => ({ default: () => null }));
vi.mock("./DetailsModal", () => ({ default: () => null }));
vi.mock("./AbsentCompetitors/ChangeCompetingGroupModal", () => ({
    default: () => <p>Change group dialog</p>,
}));
vi.mock("@/Pages/Main/Persons/Components/IssueWarningModal", () => ({
    default: () => null,
}));
vi.mock("./ReplacedModal", () => ({
    default: ({
        onConfirm,
    }: {
        onConfirm: (wasPresent: boolean, replacedById?: string) => void;
    }) => (
        <button type="button" onClick={() => onConfirm(true, "p-z")}>
            Confirm replacement
        </button>
    ),
}));
vi.mock("@/lib/results", () => ({
    getRankingFromPreviousRound: (_roundId: string, registrantId: number) =>
        registrantId * 2,
}));

const activity = (
    id: string,
    role: string,
    status: StaffActivityStatus,
    extra: Partial<StaffActivity> = {}
) =>
    ({
        id,
        groupId: "333-r1-g1",
        role,
        status,
        isAssigned: true,
        person: { id: `p-${id}`, name: `Person ${id}` },
        leftEarly: false,
        noShow: false,
        device: { name: "12" },
        ...extra,
    }) as StaffActivity;

const handlers = () => ({
    onChanged: vi.fn(),
    onMarkPresent: vi.fn(),
    onMarkAbsent: vi.fn(),
    onMarkAllPresent: vi.fn(),
    onMarkLate: vi.fn(),
    onMarkReplaced: vi.fn(),
    onSetLeftEarly: vi.fn(),
    onSetNoShow: vi.fn(),
});

const judges = [
    activity("a", "JUDGE", StaffActivityStatus.ABSENT),
    activity("b", "JUDGE", StaffActivityStatus.PRESENT),
    activity("c", "JUDGE", StaffActivityStatus.LATE),
    activity("d", "RUNNER", StaffActivityStatus.PRESENT),
];

describe("RoleCard", () => {
    it("splits the role into absent and present with a present count", () => {
        render(
            <RoleCard
                role="JUDGE"
                title="Judges"
                icon={Gavel}
                attendance={judges}
                groupId="333-r1-g1"
                {...handlers()}
            />
        );
        const card = screen.getByRole("region", { name: "Judges" });
        expect(card.textContent).toContain("2/3");
        expect(within(card).getByText("Late")).toBeTruthy();
        expect(within(card).queryByText("Person d")).toBeNull();
    });

    it("marks everyone still absent present in one go", async () => {
        const props = handlers();
        render(
            <RoleCard
                role="JUDGE"
                title="Judges"
                icon={Gavel}
                attendance={[
                    ...judges,
                    activity("e", "JUDGE", StaffActivityStatus.ABSENT),
                ]}
                groupId="333-r1-g1"
                {...props}
            />
        );
        await userEvent.click(
            screen.getByRole("button", { name: "Mark all present" })
        );
        expect(props.onMarkAllPresent).toHaveBeenCalledWith(["a", "e"]);
    });

    it("offers Mark all present only when two or more are absent", () => {
        render(
            <RoleCard
                role="JUDGE"
                title="Judges"
                icon={Gavel}
                attendance={judges}
                groupId="333-r1-g1"
                {...handlers()}
            />
        );
        expect(
            screen.queryByRole("button", { name: "Mark all present" })
        ).toBeNull();
    });

    it("shows stations only once runners are assigned", () => {
        const { rerender } = render(
            <RoleCard
                role="JUDGE"
                title="Judges"
                icon={Gavel}
                attendance={judges}
                groupId="333-r1-g1"
                showStations={false}
                {...handlers()}
            />
        );
        expect(screen.queryByText(/Station 12/)).toBeNull();
        rerender(
            <RoleCard
                role="JUDGE"
                title="Judges"
                icon={Gavel}
                attendance={judges}
                groupId="333-r1-g1"
                showStations
                {...handlers()}
            />
        );
        expect(screen.getAllByText(/Station 12/)).toHaveLength(2);
    });

    it("marks absent staff present and offers the rest in the menu", async () => {
        const props = handlers();
        render(
            <RoleCard
                role="JUDGE"
                title="Judges"
                icon={Gavel}
                attendance={judges}
                groupId="333-r1-g1"
                {...props}
            />
        );
        await userEvent.click(
            screen.getByRole("button", { name: "Mark present" })
        );
        expect(props.onMarkPresent).toHaveBeenCalledWith("a");

        await userEvent.click(
            screen.getByRole("button", { name: "More actions for Person b" })
        );
        const items = await screen.findAllByRole("menuitem");
        expect(items.map((item) => item.textContent)).toEqual([
            "Left early",
            "Comment",
            "Mark absent",
        ]);
        await userEvent.click(items[2]);
        expect(props.onMarkAbsent).toHaveBeenCalledWith("b");
    });

    it("offers what can happen to someone absent, in order", async () => {
        const props = handlers();
        render(
            <RoleCard
                role="JUDGE"
                title="Judges"
                icon={Gavel}
                attendance={judges}
                groupId="333-r1-g1"
                {...props}
            />
        );
        await userEvent.click(
            screen.getByRole("button", { name: "More actions for Person a" })
        );
        const items = await screen.findAllByRole("menuitem");
        expect(items.map((item) => item.textContent)).toEqual([
            "Mark late",
            "Replaced…",
            "Not coming today",
            "Comment",
        ]);
        await userEvent.click(items[2]);
        expect(props.onSetNoShow).toHaveBeenCalledWith(judges[0], true);
    });

    it("records who replaced someone", async () => {
        const props = handlers();
        render(
            <RoleCard
                role="JUDGE"
                title="Judges"
                icon={Gavel}
                attendance={judges}
                groupId="333-r1-g1"
                {...props}
            />
        );
        await userEvent.click(
            screen.getByRole("button", { name: "More actions for Person a" })
        );
        await userEvent.click(
            await screen.findByRole("menuitem", { name: "Replaced…" })
        );
        await userEvent.click(
            screen.getByRole("button", { name: "Confirm replacement" })
        );
        expect(props.onMarkReplaced).toHaveBeenCalledWith("a", true, "p-z");
    });

    it("lists those not coming today last, and lets them come after all", async () => {
        const props = handlers();
        const notComing = activity("x", "JUDGE", StaffActivityStatus.ABSENT, {
            noShow: true,
        });
        render(
            <RoleCard
                role="JUDGE"
                title="Judges"
                icon={Gavel}
                attendance={[notComing, ...judges]}
                groupId="333-r1-g1"
                {...props}
            />
        );
        const absent = screen
            .getAllByRole("listitem")
            .filter((item) => item.textContent?.includes("Person"));
        expect(absent[0].textContent).toContain("Person a");
        expect(absent[1].textContent).toContain("Person x");
        expect(absent[1].textContent).toContain("Not coming");

        await userEvent.click(
            screen.getByRole("button", { name: "More actions for Person x" })
        );
        await userEvent.click(
            await screen.findByRole("menuitem", { name: "Coming after all" })
        );
        expect(props.onSetNoShow).toHaveBeenCalledWith(notComing, false);
    });

    it("shows every tag of someone present, and who covered for whom", async () => {
        const props = handlers();
        render(
            <RoleCard
                role="JUDGE"
                title="Judges"
                icon={Gavel}
                attendance={[
                    activity("c", "JUDGE", StaffActivityStatus.LATE, {
                        leftEarly: true,
                    }),
                    activity("r", "JUDGE", StaffActivityStatus.REPLACED, {
                        replacedById: "p-z",
                        replacedBy: { id: "p-z", name: "Person z" },
                    }),
                    activity("z", "JUDGE", StaffActivityStatus.PRESENT, {
                        isAssigned: false,
                    }),
                ]}
                groupId="333-r1-g1"
                {...props}
            />
        );
        expect(screen.getByText("Late")).toBeTruthy();
        expect(screen.getByText("Left early")).toBeTruthy();
        expect(screen.getByText("Replaced by Person z")).toBeTruthy();
        expect(screen.getByText("Covering for Person r")).toBeTruthy();
        expect(screen.queryByText("Unassigned")).toBeNull();

        await userEvent.click(
            screen.getByRole("button", { name: "More actions for Person c" })
        );
        await userEvent.click(
            await screen.findByRole("menuitem", { name: "Didn't leave early" })
        );
        expect(props.onSetLeftEarly).toHaveBeenCalledWith("c", false);
    });

    it("lets absent competitors change group instead of being marked present", async () => {
        render(
            <RoleCard
                role="COMPETITOR"
                title="Competitors"
                icon={Users}
                attendance={[
                    activity("e", "COMPETITOR", StaffActivityStatus.ABSENT),
                ]}
                groupId="333-r1-g1"
                {...handlers()}
            />
        );
        expect(
            screen.queryByRole("button", { name: "Mark present" })
        ).toBeNull();
        expect(screen.queryByRole("button", { name: /Add a/ })).toBeNull();
        await userEvent.click(
            screen.getByRole("button", { name: "Change group" })
        );
        expect(screen.getByText("Change group dialog")).toBeTruthy();
    });

    it("shows every competitor's place in the previous round", () => {
        const competitor = (
            id: string,
            status: StaffActivityStatus,
            registrantId: number
        ) =>
            activity(id, "COMPETITOR", status, {
                groupId: "333-r2-g1",
                person: {
                    id: `p-${id}`,
                    name: `Person ${id}`,
                    registrantId,
                } as StaffActivity["person"],
            });
        render(
            <RoleCard
                role="COMPETITOR"
                title="Competitors"
                icon={Users}
                attendance={[
                    competitor("e", StaffActivityStatus.ABSENT, 2),
                    competitor("f", StaffActivityStatus.PRESENT, 3),
                ]}
                groupId="333-r2-g1"
                {...handlers()}
            />
        );
        expect(screen.getByText("Person e").textContent).toBe("Person e (4)");
        expect(screen.getByText("Person f").textContent).toBe("Person f (6)");
    });
});
