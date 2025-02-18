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
import { NewUserData, WCAPerson } from "@/lib/interfaces";
import { createWCAUserSchema } from "@/lib/schema/userSchema";
import { getAvailableRoles } from "@/lib/utils";

import WCAPersonsAutocomplete from "../WCAPersonsAutocomplete";

interface CreateWCAUserFormProps {
    handleSubmit: (data: NewUserData) => void;
    isLoading?: boolean;
}

const CreateWCAUserForm = ({
    handleSubmit,
    isLoading,
}: CreateWCAUserFormProps) => {
    const [selectedPerson, setSelectedPerson] = useState<WCAPerson | null>(
        null
    );
    const form = useForm<z.infer<typeof createWCAUserSchema>>({
        resolver: zodResolver(createWCAUserSchema),
    });

    const onSubmit = (values: z.infer<typeof createWCAUserSchema>) => {
        handleSubmit({
            ...values,
            wcaId: selectedPerson?.wcaId ?? values.wcaId,
            fullName: selectedPerson?.name ?? "",
            roles: values.roles,
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
                <ModalActions>
                    <Button
                        type="submit"
                        variant="success"
                        disabled={isLoading}
                    >
                        Create
                    </Button>
                </ModalActions>
            </form>
        </Form>
    );
};

export default CreateWCAUserForm;
