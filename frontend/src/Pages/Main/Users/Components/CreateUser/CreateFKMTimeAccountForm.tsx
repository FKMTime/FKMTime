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
import { MultiSelect } from "@/Components/ui/multi-select";
import { NewUserData } from "@/lib/interfaces";
import { createFKMTimeUserSchema } from "@/lib/schema/userSchema";
import { getAvailableRoles } from "@/lib/utils";

interface CreateFKMTimeAccountFormProps {
    handleSubmit: (data: NewUserData) => void;
    isLoading?: boolean;
}

const CreateFKMTimeAccountForm = ({
    handleSubmit,
    isLoading,
}: CreateFKMTimeAccountFormProps) => {
    const form = useForm<
        z.input<typeof createFKMTimeUserSchema>,
        unknown,
        z.output<typeof createFKMTimeUserSchema>
    >({
        resolver: zodResolver(createFKMTimeUserSchema),
    });

    const onSubmit = (values: z.infer<typeof createFKMTimeUserSchema>) => {
        handleSubmit(values);
    };

    return (
        <Form {...form}>
            <form
                onSubmit={form.handleSubmit(onSubmit)}
                className="space-y-8 py-3"
            >
                <FormField
                    control={form.control}
                    name="username"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>Username</FormLabel>
                            <FormControl>
                                <Input placeholder="Username" {...field} />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                    )}
                />
                <FormField
                    control={form.control}
                    name="fullName"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>Full name</FormLabel>
                            <FormControl>
                                <Input placeholder="Full name" {...field} />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                    )}
                />
                <FormField
                    control={form.control}
                    name="password"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>Password</FormLabel>
                            <FormControl>
                                <Input
                                    type="password"
                                    placeholder="Password"
                                    {...field}
                                />
                            </FormControl>
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
                <ModalActions>
                    <Button type="submit" disabled={isLoading}>
                        Create
                    </Button>
                </ModalActions>
            </form>
        </Form>
    );
};

export default CreateFKMTimeAccountForm;
