import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { Modal } from "@/Components/Modal";
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
import { useDialogError } from "@/hooks/useDialogError";
import { User } from "@/lib/interfaces";
import { editUserSchema } from "@/lib/schema/userSchema";
import { updateUser } from "@/lib/user";
import { getAvailableRoles } from "@/lib/utils";

interface EditUserModalProps {
    isOpen: boolean;
    onClose: () => void;
    user: User;
}

const EditUserModal = ({ isOpen, onClose, user }: EditUserModalProps) => {
    const [error, setError] = useDialogError(isOpen);
    const [isLoading, setIsLoading] = useState(false);
    const isWcaAccount = user.wcaUserId !== null;

    const form = useForm<z.infer<typeof editUserSchema>>({
        resolver: zodResolver(editUserSchema),
        defaultValues: {
            username: user.username ?? undefined,
            fullName: user.fullName ?? undefined,
            roles: user.roles,
        },
    });

    const onSubmit = async (values: z.infer<typeof editUserSchema>) => {
        setIsLoading(true);

        const response = await updateUser({
            ...user,
            ...values,
        });
        if (response.status === 200) {
            onClose();
        } else if (response.status === 400) {
            setError(response.data.message);
        } else if (response.status == 403) {
            setError("You cannot assign roles higher than your own");
        } else if (response.status === 409) {
            setError("Username already taken!");
        } else {
            setError("Something went wrong");
        }
        setIsLoading(false);
    };

    return (
        <Modal
            error={error}
            isOpen={isOpen}
            onClose={onClose}
            title="Edit user"
        >
            <div className="flex flex-col gap-5">
                <Form {...form}>
                    <form
                        onSubmit={form.handleSubmit(onSubmit)}
                        className="space-y-8 py-3"
                    >
                        {!isWcaAccount && (
                            <>
                                <FormField
                                    control={form.control}
                                    name="username"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Username</FormLabel>
                                            <FormControl>
                                                <Input
                                                    placeholder="Username"
                                                    {...field}
                                                />
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
                                                <Input
                                                    placeholder="Full name"
                                                    {...field}
                                                />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                            </>
                        )}
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
                                Edit
                            </Button>
                        </ModalActions>
                    </form>
                </Form>
            </div>
        </Modal>
    );
};

export default EditUserModal;
