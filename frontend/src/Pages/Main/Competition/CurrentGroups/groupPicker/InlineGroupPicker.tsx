/**
 * The group picker on phones: a panel under the room row, one step at a
 * time (event → round → group), with a breadcrumb to step back.
 */
import { ReactNode } from "react";

import { Button } from "@/Components/ui/button";
import { getEventShortName } from "@/lib/events";
import { shortRoundName } from "@/lib/utils";

import { handlePickerKeys, usePickerSteps } from "./pickerModel";
import { PickerBreadcrumb } from "./pickerParts";
import PickerStepBody from "./PickerStepBody";
import { PickerProps, usePickerContext } from "./usePickerContext";

interface InlineGroupPickerProps extends PickerProps {
    /** The Switch to … / Run both step, once a group is picked */
    decision?: ReactNode;
}

const InlineGroupPicker = (props: InlineGroupPickerProps) => {
    const { room, onCancel, decision } = props;
    const { events, timezone, suggestion, stepOptions } =
        usePickerContext(props);
    const steps = usePickerSteps(stepOptions);

    return (
        <div
            role="group"
            aria-label={`Change group in ${room.name}`}
            onKeyDown={(e) => handlePickerKeys(e, { onEscape: steps.back })}
            className="flex flex-col gap-3 rounded-xl border bg-card p-3"
        >
            <div className="flex items-center justify-between gap-2">
                <PickerBreadcrumb
                    step={steps.step}
                    eventShort={
                        steps.eventId && getEventShortName(steps.eventId)
                    }
                    roundShort={steps.roundId && shortRoundName(steps.roundId)}
                    isRoundSkipped={steps.isRoundSkipped}
                    onGoTo={steps.goTo}
                />
                <Button variant="ghost" size="sm" onClick={onCancel}>
                    Cancel
                </Button>
            </div>
            {decision ?? (
                <PickerStepBody
                    steps={steps}
                    events={events}
                    timezone={timezone}
                    suggestion={suggestion}
                />
            )}
        </div>
    );
};

export default InlineGroupPicker;
