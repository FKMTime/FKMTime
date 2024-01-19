import { StyleSheet } from 'react-native';

import { Text, View } from '../../components/Themed';
import { getCompetitionInfo } from '../../lib/competition';
import { useEffect, useState } from 'react';
import { Attempt, Competition } from '../../lib/interfaces';
import { getUnresolvedAttempts } from '../../lib/attempts';
import Case from '../../components/Case';

export default function TabOneScreen() {
  const [competitionInfo, setCompetitionInfo] = useState<Competition | null>(null);
  const [attempts, setAttempts] = useState<Attempt[]>([]);

  const fetchCompetitionInfo = async () => {
    const data = await getCompetitionInfo();
    setCompetitionInfo(data);
  };

  const fetchAttemptsData = async () => {
    const data = await getUnresolvedAttempts();
    setAttempts(data);
  };

  useEffect(() => {
    fetchCompetitionInfo();
    fetchAttemptsData();
  }, []);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{competitionInfo?.name}</Text>
      <View style={styles.casesContainer}>
      <Text style={styles.title}>Unresolved delegate cases:</Text>
        {attempts.map((attempt: Attempt) => (
          <Case attempt={attempt} />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  separator: {
    marginVertical: 30,
    height: 1,
    width: '80%',
  },
  casesContainer: {
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 10,
  }
});
