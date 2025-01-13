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
import { useToast } from "@/hooks/useToast";
import { changePasswordSchema } from "@/lib/schema/settingsSchema";
import { changePassword } from "@/lib/settings";

interface ChangePasswordModalProps {
    isOpen: boolean;
    onClose: () => void;
}

const ChangePasswordModal = ({ isOpen, onClose }: ChangePasswordModalProps) => {
    const { toast } = useToast();
    const [isLoading, setIsLoading] = useState(false);

    const form = useForm<z.infer<typeof changePasswordSchema>>({
        resolver: zodResolver(changePasswordSchema),
    });

    const onSubmit = async (values: z.infer<typeof changePasswordSchema>) => {
        setIsLoading(true);
        if (values.newPassword !== values.confirmPassword) {
            toast({
                title: "Error",
                description: "Passwords do not match",
                variant: "destructive",
            });
            setIsLoading(false);
            return;
        }

        const status = await changePassword(
            values.currentPassword,
            values.newPassword
        );
        if (status === 200) {
            toast({
                title: "Successfully changed password.",
                variant: "success",
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
                        name="currentPassword"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>Current password</FormLabel>
                                <FormControl>
                                    <Input
                                        type="password"
                                        placeholder="Current password"
                                        {...field}
                                    />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                    <FormField
                        control={form.control}
                        name="newPassword"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>New password</FormLabel>
                                <FormControl>
                                    <Input
                                        type="password"
                                        placeholder="New password"
                                        {...field}
                                    />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                    <FormField
                        control={form.control}
                        name="confirmPassword"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>Confirm new password</FormLabel>
                                <FormControl>
                                    <Input
                                        type="password"
                                        placeholder="Confirm new password"
                                        {...field}
                                    />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                    <ModalActions>
                        <Button
                            variant="success"
                            type="submit"
                            disabled={isLoading}
                        >
                            Save
                        </Button>
                    </ModalActions>
                </form>
            </Form>
        </Modal>
    );
};

export default ChangePasswordModal;
