import { Link as RouterLink } from "react-router-dom";
import {
    Box,
    Heading,
    Link,
    ListItem,
    OrderedList,
    UnorderedList,
} from "@chakra-ui/react";

const Tutorial = (): JSX.Element => {
    return (
        <Box display="flex" flexDirection="column" gap="5">
            <Heading>Table of contents</Heading>
            <OrderedList spacing={3} fontSize={20}>
                <ListItem>
                    <Link href="#before_competition">
                        Things to do before the competition
                    </Link>
                </ListItem>
                <ListItem>
                    <Link href="#during_competition">
                        Things to do during the competition
                    </Link>
                </ListItem>
                <ListItem>
                    <Link href="#basic_information">Basic information</Link>
                </ListItem>
            </OrderedList>
            <Box
                id="before_competition"
                display="flex"
                flexDirection="column"
                gap="5"
                mt="5"
            >
                <Heading fontSize="30">
                    Things to do before the competition
                </Heading>
                <OrderedList spacing={3} fontSize={20}>
                    <ListItem>
                        Import a competition from the WCA Website (after
                        creating groups)
                    </ListItem>
                    <ListItem>Create an account for the delegate</ListItem>
                    <ListItem>
                        Assign RFID cards to the competitors in the{" "}
                        <RouterLink
                            style={{
                                textDecoration: "underline",
                            }}
                            to="/persons"
                        >
                            persons
                        </RouterLink>{" "}
                        tab
                    </ListItem>
                    <ListItem>
                        Add all stations with their ESP ids in the{" "}
                        <RouterLink
                            style={{
                                textDecoration: "underline",
                            }}
                            to="/stations"
                        >
                            stations
                        </RouterLink>{" "}
                        tab
                    </ListItem>
                    <ListItem>
                        Remember to set the scoretaking token from the WCA Live
                        in the{" "}
                        <RouterLink
                            style={{
                                textDecoration: "underline",
                            }}
                            to="/competition"
                        >
                            competition
                        </RouterLink>{" "}
                        tab. This token is valid for 7 days so it is recommended
                        to set it up just before the competition.
                    </ListItem>
                </OrderedList>
            </Box>
            <Box
                id="during_competition"
                display="flex"
                flexDirection="column"
                gap="5"
                mt="5"
            >
                <Heading fontSize="30">
                    Things to do during the competition
                </Heading>
                <UnorderedList spacing={3} fontSize={20}>
                    <ListItem>
                        Make sure that the delegate are connected to the same
                        network as the server & stations
                    </ListItem>
                    <ListItem>Make sure that the server is running</ListItem>
                    <ListItem>Make sure that all stations are charged</ListItem>
                    <ListItem>
                        Remember to set the current group when a new one starts
                        in the{" "}
                        <RouterLink
                            style={{
                                textDecoration: "underline",
                            }}
                            to="/competition"
                        >
                            competition
                        </RouterLink>{" "}
                        tab
                    </ListItem>
                </UnorderedList>
            </Box>
            <Box
                id="basic_information"
                display="flex"
                flexDirection="column"
                gap="5"
                mt="5"
            >
                <Heading fontSize="30">Basic information</Heading>
                <UnorderedList spacing={3} fontSize={20}>
                    <ListItem>The server is running on port 5000</ListItem>
                    <ListItem>Every station has a FKMTime device</ListItem>
                    <ListItem>
                        Competitor sitting at the station should scan a card and
                        then device will show the competitor's name and
                        registrant ID
                    </ListItem>
                    <ListItem>
                        After the solve the judge should scan the card if
                        everything is okay or press penalty/delegate button
                    </ListItem>
                    <ListItem>
                        The FKMTime system automatically assigns attempts
                        numbers to the solves
                    </ListItem>
                    <ListItem>
                        The FKMTime system automatically check limits (time
                        limit, cutoff, cumulative limits)
                    </ListItem>
                    <ListItem>
                        After the delegate button is pressed on the FKMTime
                        device the WCA delegate will receive a notification in
                        the mobile app.
                    </ListItem>
                </UnorderedList>
            </Box>
        </Box>
    );
};

export default Tutorial;
