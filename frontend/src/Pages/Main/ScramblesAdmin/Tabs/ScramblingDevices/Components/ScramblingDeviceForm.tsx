import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useState } from "react";
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
import { Room, ScramblingDevice } from "@/lib/interfaces";
import { getAllRooms } from "@/lib/rooms";
import { scramblingDeviceSchema } from "@/lib/schema/scramblingDeviceSchema";

interface ScramblingDeviceFormProps {
    handleSubmit: (device: ScramblingDevice) => void;
    device: ScramblingDevice;
    isLoading: boolean;
}

const ScramblingDeviceForm = ({
    handleSubmit,
    device,
    isLoading,
}: ScramblingDeviceFormProps) => {
    const [rooms, setRooms] = useState<Room[]>([]);

    const form = useForm<z.infer<typeof scramblingDeviceSchema>>({
        resolver: zodResolver(scramblingDeviceSchema),
        defaultValues: {
            name: device ? device.name : "",
            roomId: device.id
                ? device.room.id
                : rooms.length === 1
                  ? rooms[0].id
                  : "",
        },
    });
    const onSubmit = (values: z.infer<typeof scramblingDeviceSchema>) => {
        handleSubmit({
            ...device,
            ...values,
        });
    };

    useEffect(() => {
        getAllRooms().then((data: Room[]) => {
            setRooms(data);
        });
    }, [form]);

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
                    name="roomId"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>Room</FormLabel>
                            <Select
                                onValueChange={field.onChange}
                                defaultValue={field.value}
                            >
                                <FormControl>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Select room" />
                                    </SelectTrigger>
                                </FormControl>
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
                        Save
                    </Button>
                </ModalActions>
            </form>
        </Form>
    );
};

export default ScramblingDeviceForm;
