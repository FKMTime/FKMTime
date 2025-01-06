import { motion } from "framer-motion";
import { ReactNode } from "react";

import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";

interface StatCardProps {
    title: string;
    stat: string;
    icon: ReactNode;
}

const StatCard = ({ title, stat, icon }: StatCardProps) => {
    return (
        <Card className="w-full h-fit">
            <CardHeader>
                <CardTitle className="flex gap-1 items-center">
                    {icon} {title}
                </CardTitle>
            </CardHeader>
            <CardContent className="text-2xl font-bold">
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5, ease: "easeOut" }}
                >
                    {stat}
                </motion.div>
            </CardContent>
        </Card>
    );
};

export default StatCard;
