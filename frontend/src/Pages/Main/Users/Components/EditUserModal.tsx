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
import { useToast } from "@/hooks/useToast";
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
    const { toast } = useToast();
    const [isLoading, setIsLoading] = useState(false);
    const isWcaAccount = user.wcaUserId !== null;

    const form = useForm<z.infer<typeof editUserSchema>>({
        resolver: zodResolver(editUserSchema),
        defaultValues: {
            username: user.username,
            fullName: user.fullName,
            roles: user.roles,
        },
    });

    const onSubmit = async (values: z.infer<typeof editUserSchema>) => {
        setIsLoading(true);

        const status = await updateUser({
            ...user,
            ...values,
        });
        if (status === 200) {
            toast({
                title: "Successfully updated user.",
                variant: "success",
            });
            onClose();
        } else if (status == 403) {
            toast({
                title: "Error",
                description: "You cannot assign roles higher than your own",
                variant: "destructive",
            });
        } else if (status === 409) {
            toast({
                title: "Error",
                description: "Username already taken!",
                variant: "destructive",
            });
        } else {
            toast({
                title: "Error",
                description: "Something went wrong",
                variant: "destructive",
            });
        }
        setIsLoading(false);
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Edit user">
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
                            <Button
                                type="submit"
                                variant="success"
                                disabled={isLoading}
                            >
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
