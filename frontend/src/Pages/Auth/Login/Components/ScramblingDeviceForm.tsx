import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { Button } from "@/Components/ui/button";
import {
    Form,
    FormControl,
    FormField,
    FormItem,
    FormMessage,
} from "@/Components/ui/form";
import {
    InputOTP,
    InputOTPGroup,
    InputOTPSlot,
} from "@/Components/ui/input-otp";
import { scramblingDeviceLoginSchema } from "@/lib/schema/scramblingDeviceAuthSchema";

interface ScramblingDeviceFormProps {
    handleSubmit: (code: string) => void;
    isLoading?: boolean;
}

const ScramblingDeviceForm = ({
    handleSubmit,
    isLoading,
}: ScramblingDeviceFormProps) => {
    const form = useForm<z.infer<typeof scramblingDeviceLoginSchema>>({
        resolver: zodResolver(scramblingDeviceLoginSchema),
    });

    const onSubmit = (values: z.infer<typeof scramblingDeviceLoginSchema>) => {
        handleSubmit(values.code);
    };

    return (
        <Form {...form}>
            <form
                onSubmit={form.handleSubmit(onSubmit)}
                className="w-2/3 space-y-6"
            >
                <FormField
                    control={form.control}
                    name="code"
                    render={({ field }) => (
                        <FormItem className="flex flex-col items-center">
                            <FormControl>
                                <InputOTP maxLength={6} {...field}>
                                    <InputOTPGroup>
                                        <InputOTPSlot
                                            index={0}
                                            className="h-12 w-12 text-lg"
                                        />
                                        <InputOTPSlot
                                            index={1}
                                            className="h-12 w-12 text-lg"
                                        />
                                        <InputOTPSlot
                                            index={2}
                                            className="h-12 w-12 text-lg"
                                        />
                                        <InputOTPSlot
                                            index={3}
                                            className="h-12 w-12 text-lg"
                                        />
                                        <InputOTPSlot
                                            index={4}
                                            className="h-12 w-12 text-lg"
                                        />
                                        <InputOTPSlot
                                            index={5}
                                            className="h-12 w-12 text-lg"
                                        />
                                    </InputOTPGroup>
                                </InputOTP>
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                    )}
                />

                <Button
                    type="submit"
                    disabled={isLoading}
                    className="w-full"
                    variant="success"
                >
                    Submit
                </Button>
            </form>
        </Form>
    );
};

export default ScramblingDeviceForm;
