import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import ModalActions from "@/Components/ModalActions";
import { Button } from "@/Components/ui/button";
import {
    Form,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from "@/Components/ui/form";
import { MultiSelect } from "@/Components/ui/multi-select";
import { NewUserData, Room, WCAPerson } from "@/lib/interfaces";
import { createWCAUserSchema } from "@/lib/schema/userSchema";
import {
    initialStageLeadRooms,
    needsRoomChoice,
    stageLeadRoomsPayload,
} from "@/lib/stageLeadRooms";
import { getAvailableRoles } from "@/lib/utils";

import StageLeadRoomsField from "../StageLeadRoomsField";
import WCAPersonsAutocomplete from "../WCAPersonsAutocomplete";

interface CreateWCAUserFormProps {
    handleSubmit: (data: NewUserData) => void;
    isLoading?: boolean;
    /** The competition's rooms, in schedule order */
    rooms?: Room[];
}

const CreateWCAUserForm = ({
    handleSubmit,
    isLoading,
    rooms = [],
}: CreateWCAUserFormProps) => {
    const [stageLeadRooms, setStageLeadRooms] = useState(initialStageLeadRooms);
    const [selectedPerson, setSelectedPerson] = useState<WCAPerson | null>(
        null
    );
    const form = useForm<
        z.input<typeof createWCAUserSchema>,
        unknown,
        z.output<typeof createWCAUserSchema>
    >({
        resolver: zodResolver(createWCAUserSchema),
    });
    const roles = form.watch("roles") ?? [];

    const onSubmit = (values: z.infer<typeof createWCAUserSchema>) => {
        handleSubmit({
            ...values,
            wcaId: selectedPerson?.wcaId ?? values.wcaId,
            fullName: selectedPerson?.name ?? "",
            roles: values.roles,
            ...stageLeadRoomsPayload(
                values.roles,
                rooms.length,
                stageLeadRooms
            ),
        });
    };

    return (
        <Form {...form}>
            <form
                onSubmit={form.handleSubmit(onSubmit)}
                className="space-y-8 py-3"
            >
                <FormField
                    control={form.control}
                    name="wcaId"
                    render={({ field }) => (
                        <FormItem className="flex flex-col">
                            <FormLabel>Search for a person</FormLabel>
                            <WCAPersonsAutocomplete
                                onSelect={(person) => {
                                    field.onChange(person?.wcaId);
                                    setSelectedPerson(person);
                                }}
                            />
                            <FormMessage />
                        </FormItem>
                    )}
                />
                <FormField
                    control={form.control}
                    name="roles"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>Roles</FormLabel>
                            <MultiSelect
                                options={getAvailableRoles()}
                                onValueChange={field.onChange}
                                defaultValue={field.value}
                                placeholder="Select roles"
                                variant="inverted"
                            />
                            <FormMessage />
                        </FormItem>
                    )}
                />
                <StageLeadRoomsField
                    roles={roles}
                    rooms={rooms}
                    value={stageLeadRooms}
                    onChange={setStageLeadRooms}
                />
                <ModalActions>
                    <Button
                        type="submit"
                        disabled={
                            isLoading ||
                            needsRoomChoice(roles, rooms.length, stageLeadRooms)
                        }
                    >
                        Create
                    </Button>
                </ModalActions>
            </form>
        </Form>
    );
};

export default CreateWCAUserForm;
