import { Pressable, StyleSheet, Text, View } from "react-native";
import { Attempt } from "../lib/interfaces";
import events from "../constants/events";
import { resultToString } from "../lib/resultFormatters";
import { Link } from "expo-router";

interface CaseProps {
    attempt: Attempt;
}

const Case: React.FC<CaseProps> = ({ attempt }): JSX.Element => {
    const roundNumber = attempt.result.roundId.split('-r')[1];
    return (
        <Link href={{
            pathname: '/case',
            params: { id: attempt.id }
        }} asChild>
            <Pressable style={styles.container}>
                <View style={styles.roundDetails}>
                    <Text style={styles.text}>{events.find((event) => event.id === attempt.result.eventId)?.name}</Text>
                    <Text style={styles.text}>Round {roundNumber}</Text>
                </View>
                <Text style={styles.text}>Competitor: {attempt.result.person.name}</Text>
                <Text style={styles.text}>Attempt: {attempt.attemptNumber}</Text>
                <Text style={styles.text}>Time: {resultToString(attempt.value)}</Text>
                <Text style={styles.text}>Station: {attempt.station.name}</Text>
                <Text style={styles.text}>Judge: {attempt.judge.name}</Text>
            </Pressable>
        </Link>
    )
};

const styles = StyleSheet.create({
    container: {
        backgroundColor: '#319795',
        color: 'white',
        padding: 10,
        borderRadius: 10,
        width: '100%',
        display: "flex",
        flexDirection: "column",
        alignItems: "flex-start",
        gap: 5,
    },
    roundDetails: {
        display: 'flex',
        flexDirection: 'row',
        gap: 2,
        mb: 5,
    },
    text: {
        color: 'white',
        fontWeight: 'bold',
    }
});

export default Case;
