import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";

import ModalActions from "@/Components/ModalActions";
import { Button } from "@/Components/ui/button";
import {
    Form,
    FormControl,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from "@/Components/ui/form";
import { Input } from "@/Components/ui/input";
import { AddPerson } from "@/lib/interfaces";
import { addPersonSchema } from "@/lib/schema/personSchema";

import CountrySelect from "./CountrySelect";
import GenderSelect from "./GenderSelect";

interface PersonFormProps {
    canCompete?: boolean;
    isLoading: boolean;
    handleSubmit: (data: AddPerson) => void;
}

const PersonForm = ({
    canCompete = false,
    isLoading,
    handleSubmit,
}: PersonFormProps) => {
    const form = useForm<z.infer<typeof addPersonSchema>>({
        resolver: zodResolver(addPersonSchema),
    });

    const onSubmit = (values: z.infer<typeof addPersonSchema>) => {
        handleSubmit({
            ...values,
            canCompete,
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
                    name="name"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>Name</FormLabel>
                            <FormControl>
                                <Input placeholder="Name" {...field} />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                    )}
                />
                <FormField
                    control={form.control}
                    name="gender"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>Gender</FormLabel>
                            <GenderSelect
                                value={field.value}
                                onChange={field.onChange}
                            />
                            <FormMessage />
                        </FormItem>
                    )}
                />
                {canCompete && (
                    <>
                        <FormField
                            control={form.control}
                            name="wcaId"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>WCA ID</FormLabel>
                                    <FormControl>
                                        <Input
                                            placeholder="WCA ID"
                                            {...field}
                                        />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <FormField
                            control={form.control}
                            name="countryIso2"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Country</FormLabel>
                                    <CountrySelect
                                        value={field.value || ""}
                                        onChange={field.onChange}
                                    />

                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                    </>
                )}
                <FormField
                    control={form.control}
                    name="cardId"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>Card</FormLabel>
                            <FormControl>
                                <Input placeholder="Scan card" {...field} />
                            </FormControl>
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
                        Add person
                    </Button>
                </ModalActions>
            </form>
        </Form>
    );
};

export default PersonForm;
