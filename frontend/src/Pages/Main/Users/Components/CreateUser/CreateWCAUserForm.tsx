import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { Button } from "@/Components/ui/button";
import {
    Form,
    FormControl,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from "@/Components/ui/form";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/Components/ui/select";
import { NewUserData, UserRole, WCAPerson } from "@/lib/interfaces";
import { createWCAUserSchema } from "@/lib/schema/userSchema";
import { prettyUserRoleName } from "@/lib/utils";

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
            role: values.role as UserRole,
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
                    name="role"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>Role</FormLabel>
                            <Select
                                onValueChange={field.onChange}
                                defaultValue={field.value}
                            >
                                <FormControl>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Select role" />
                                    </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                    {Object.keys(UserRole).map((userRole) => (
                                        <SelectItem
                                            key={userRole}
                                            value={userRole}
                                        >
                                            {prettyUserRoleName(userRole)}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            <FormMessage />
                        </FormItem>
                    )}
                />
                <Button
                    type="submit"
                    className="w-full"
                    variant="success"
                    disabled={isLoading}
                >
                    Create
                </Button>
            </form>
        </Form>
    );
};

export default CreateWCAUserForm;
