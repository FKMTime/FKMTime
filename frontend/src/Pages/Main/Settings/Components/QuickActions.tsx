/* eslint-disable react-hooks/set-state-in-effect, react-hooks/preserve-manual-memoization */
import { SquarePen } from "lucide-react";
import { useEffect, useState } from "react";

import PlusButton from "@/Components/PlusButton.tsx";
import { Card, CardContent, CardHeader, CardTitle } from "@/Components/ui/card";
import { QuickAction } from "@/lib/interfaces";
import { getQuickActions } from "@/lib/quickActions";

import CreateQuickActionModal from "./CreateQuickActionModal";
import QuickActionsTable from "./QuickActionsTable";

const QuickActions = () => {
    const [quickActions, setQuickActions] = useState<QuickAction[]>([]);
    const [isOpenCreateQuickActionModal, setIsOpenCreateQuickActionModal] =
        useState<boolean>(false);

    const fetchData = async () => {
        const data = await getQuickActions();
        setQuickActions(data);
    };

    const handleCloseCreateQuickActionModal = () => {
        setIsOpenCreateQuickActionModal(false);
        fetchData();
    };

    useEffect(() => {
        fetchData();
    }, []);

    return (
        <>
            <Card>
                <CardHeader>
                    <CardTitle className="flex justify-between items-center">
                        <div className="flex gap-2 items-center">
                            <SquarePen size={20} />
                            Quick incident actions
                        </div>
                        <PlusButton
                            onClick={() =>
                                setIsOpenCreateQuickActionModal(true)
                            }
                        />
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    {quickActions.length === 0 ? (
                        <p>No quick actions found.</p>
                    ) : (
                        <QuickActionsTable
                            quickActions={quickActions}
                            fetchData={fetchData}
                        />
                    )}
                </CardContent>
            </Card>
            <CreateQuickActionModal
                isOpen={isOpenCreateQuickActionModal}
                onClose={handleCloseCreateQuickActionModal}
            />
        </>
    );
};

export default QuickActions;
