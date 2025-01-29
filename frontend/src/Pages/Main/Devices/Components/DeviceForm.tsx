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
import { Device, DeviceType, Room } from "@/lib/interfaces";
import { deviceSchema } from "@/lib/schema/deviceSchema";
import { prettyDeviceType } from "@/lib/utils";

interface DeviceFormProps {
    defaultValues: Device;
    handleSubmit: (data: Device) => void;
    rooms: Room[];
    availableTypes: DeviceType[];
    submitText: string;
    isLoading: boolean;
}
const DeviceForm = ({
    defaultValues,
    handleSubmit,
    rooms,
    availableTypes,
    submitText,
    isLoading,
}: DeviceFormProps) => {
    const form = useForm<z.infer<typeof deviceSchema>>({
        resolver: zodResolver(deviceSchema),
        defaultValues: {
            name: defaultValues.name,
            espId: defaultValues.espId.toString(),
            roomId: defaultValues.roomId ? defaultValues.roomId : "",
            type: defaultValues.type,
        },
    });
    const onSubmit = (values: z.infer<typeof deviceSchema>) => {
        handleSubmit({
            ...defaultValues,
            ...values,
            espId: parseInt(values.espId),
            type: values.type as DeviceType,
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
                    name="espId"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>ESP ID</FormLabel>
                            <FormControl>
                                <Input placeholder="ESP ID" {...field} />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                    )}
                />
                <FormField
                    control={form.control}
                    name="roomId"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>Room</FormLabel>
                            <FormControl>
                                <Select
                                    onValueChange={field.onChange}
                                    defaultValue={field.value}
                                >
                                    <SelectTrigger>
                                        <SelectValue placeholder="Select room" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {rooms.map((room) => (
                                            <SelectItem
                                                key={room.id}
                                                value={room.id}
                                            >
                                                {room.name}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                    )}
                />
                <FormField
                    control={form.control}
                    name="type"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>Device type</FormLabel>
                            <Select
                                onValueChange={field.onChange}
                                defaultValue={field.value}
                            >
                                <FormControl>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Select type" />
                                    </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                    {availableTypes.map((type) => (
                                        <SelectItem key={type} value={type}>
                                            {prettyDeviceType(type)}
                                        </SelectItem>
                                    ))}
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
                        {submitText}
                    </Button>
                </ModalActions>
            </form>
        </Form>
    );
};

export default DeviceForm;
