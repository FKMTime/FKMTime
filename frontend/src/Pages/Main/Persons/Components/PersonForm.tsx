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
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/Components/ui/select";
import { POSSIBLE_GENDERS } from "@/lib/constants";
import { AddPerson, Region } from "@/lib/interfaces";
import regions from "@/lib/regions";
import { addPersonSchema } from "@/lib/schema/personSchema";
import { prettyGender } from "@/lib/utils";

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
    const countries: Region[] = regions.filter(
        (region) =>
            !["_Multiple Continents", "Continent"].includes(region.continentId)
    );

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
                            <Select
                                onValueChange={field.onChange}
                                defaultValue={field.value}
                            >
                                <FormControl>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Select gender" />
                                    </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                    {POSSIBLE_GENDERS.map((gender) => (
                                        <SelectItem key={gender} value={gender}>
                                            {prettyGender(gender)}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
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
                                    <Select
                                        onValueChange={field.onChange}
                                        defaultValue={field.value}
                                    >
                                        <FormControl>
                                            <SelectTrigger>
                                                <SelectValue placeholder="Select country" />
                                            </SelectTrigger>
                                        </FormControl>
                                        <SelectContent>
                                            {countries.map((country) => (
                                                <SelectItem
                                                    key={country.iso2}
                                                    value={country.iso2}
                                                >
                                                    {country.name}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
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
