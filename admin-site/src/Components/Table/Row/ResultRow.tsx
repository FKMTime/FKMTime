import {Tr, Td, IconButton} from "@chakra-ui/react";
import {Result} from "../../../logic/interfaces";
import {FaList} from "react-icons/fa";
import {useNavigate} from "react-router-dom";
import {getUserInfo} from "../../../logic/auth.ts";
import {HAS_WRITE_ACCESS} from "../../../logic/accounts.ts";

interface ResultRowProps {
    result: Result;
}

const ResultRow: React.FC<ResultRowProps> = ({result}): JSX.Element => {
    const navigate = useNavigate();
    const userInfo = getUserInfo();

    return (
        <>
            <Tr key={result.id}>
                <Td>{result.person.registrantId}</Td>
                <Td>{result.person.name}</Td>
                <Td>{result.person.wcaId}</Td>
                {HAS_WRITE_ACCESS.includes(userInfo.role) && (
                    <Td>
                        <IconButton icon={<FaList/>} aria-label="List" bg="none" color="white" _hover={{
                            background: "none",
                            color: "gray.400"
                        }}
                                    onClick={() => navigate(`/results/${result.id}`)}
                        />
                    </Td>
                )}
            </Tr>
        </>
    )
};

export default ResultRow;
