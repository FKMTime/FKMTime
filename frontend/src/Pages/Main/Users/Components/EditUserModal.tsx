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
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/Components/ui/select";
import { useToast } from "@/hooks/useToast";
import { User, UserRole } from "@/lib/interfaces";
import { editUserSchema } from "@/lib/schema/userSchema";
import { updateUser } from "@/lib/user";
import { prettyUserRoleName } from "@/lib/utils.ts";

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
            role: user.role as UserRole,
        },
    });

    const onSubmit = async (values: z.infer<typeof editUserSchema>) => {
        setIsLoading(true);

        const status = await updateUser({
            ...user,
            ...values,
            role: values.role as UserRole,
        });
        if (status === 200) {
            toast({
                title: "Successfully updated user.",
                variant: "success",
            });
            onClose();
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
                                            {Object.keys(UserRole).map(
                                                (userRole) => (
                                                    <SelectItem
                                                        key={userRole}
                                                        value={userRole}
                                                    >
                                                        {prettyUserRoleName(
                                                            userRole
                                                        )}
                                                    </SelectItem>
                                                )
                                            )}
                                        </SelectContent>
                                    </Select>
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
