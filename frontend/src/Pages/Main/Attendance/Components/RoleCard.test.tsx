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
        device: { name: "12" },
        ...extra,
    }) as StaffActivity;

const handlers = () => ({
    onChanged: vi.fn(),
    onMarkPresent: vi.fn(),
    onMarkAbsent: vi.fn(),
    onMarkAllPresent: vi.fn(),
    onMarkLate: vi.fn(),
    onMarkPresentButReplaced: vi.fn(),
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
            "Comment",
            "Mark absent",
        ]);
        await userEvent.click(items[1]);
        expect(props.onMarkAbsent).toHaveBeenCalledWith("b");
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
                describeCompetitor={() => " (4)"}
                {...handlers()}
            />
        );
        expect(screen.getByText(/Person e \(4\)/)).toBeTruthy();
        expect(
            screen.queryByRole("button", { name: "Mark present" })
        ).toBeNull();
        expect(screen.queryByRole("button", { name: /Add a/ })).toBeNull();
        await userEvent.click(
            screen.getByRole("button", { name: "Change group" })
        );
        expect(screen.getByText("Change group dialog")).toBeTruthy();
    });
});
