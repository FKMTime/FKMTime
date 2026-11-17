/**
 * Picks a group for a room in three steps, event → round → group: a
 * three-column dialog from `md` up, a panel under the room row on phones.
 * Only one of them is mounted, so focus never lands in a hidden copy.
 */
import { ReactNode } from "react";

import { useIsMobile } from "@/hooks/useMobile";

import GroupPickerDialog from "./GroupPickerDialog";
import InlineGroupPicker from "./InlineGroupPicker";
import { PickerProps } from "./usePickerContext";

export interface GroupPickerProps extends PickerProps {
    pickedGroupId?: string;
    /** The Switch to … / Run both step, once a group is picked */
    decision?: ReactNode;
    /** Drops the pick when the dialog's event or round changes */
    onClearPick?: () => void;
}

const GroupPicker = (props: GroupPickerProps) =>
    useIsMobile() ? (
        <InlineGroupPicker {...props} />
    ) : (
        <GroupPickerDialog {...props} />
    );

export default GroupPicker;
