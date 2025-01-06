import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { Modal } from "@/Components/Modal";
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
import { useToast } from "@/hooks/useToast";
import { User } from "@/lib/interfaces";
import { editUserPasswordSchema } from "@/lib/schema/userSchema";
import { updateUserPassword } from "@/lib/user";

interface EditUserPasswordModalProps {
    isOpen: boolean;
    onClose: () => void;
    user: User;
}

const EditUserPasswordModal = ({
    isOpen,
    onClose,
    user,
}: EditUserPasswordModalProps) => {
    const { toast } = useToast();
    const [isLoading, setIsLoading] = useState(false);

    const form = useForm<z.infer<typeof editUserPasswordSchema>>({
        resolver: zodResolver(editUserPasswordSchema),
    });

    const onSubmit = async (values: z.infer<typeof editUserPasswordSchema>) => {
        setIsLoading(true);
        const status = await updateUserPassword(user.id, values.password);
        if (status === 200) {
            toast({
                title: "Successfully changed password.",
            });
            onClose();
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
        <Modal isOpen={isOpen} onClose={onClose} title="Change password">
            <Form {...form}>
                <form
                    onSubmit={form.handleSubmit(onSubmit)}
                    className="space-y-8 py-3"
                >
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
        </Modal>
    );
};

export default EditUserPasswordModal;
