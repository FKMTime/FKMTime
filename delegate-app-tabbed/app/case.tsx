import { StatusBar } from 'expo-status-bar';
import { Platform, Pressable, StyleSheet, TextInput } from 'react-native';
import { Text, View } from '../components/Themed';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Attempt } from '../lib/interfaces';
import { getAttemptById, updateAttempt } from '../lib/attempts';
import events from '../constants/events';
import { cursorColor, placeholderTextColor } from '../constants/Colors';
import Checkbox from 'expo-checkbox';
import { Picker } from '@react-native-picker/picker';

export default function CaseScreen() {
  const local = useLocalSearchParams();
  const caseId = +local.id;

  const [attempt, setAttempt] = useState<Attempt | null>(null);

  const fetchData = async () => {
    const data = await getAttemptById(caseId);
    setAttempt(data);
  };

  const handleSubmit = async () => {
    if (!attempt) return;
    const status = await updateAttempt(attempt);
    if (status === 200) {
      router.replace('/');
      alert('Saved!');
    } else {
      alert('Something went wrong!');
    }
  };


  useEffect(() => {
    fetchData();
  }, []);

  if (!attempt) {
    return (
      <View style={styles.container}>
        <Text style={styles.loadingText}>Loading...</Text>
      </View>
    );
  }

  const roundNumber = attempt.result.roundId.split('-r')[1];

  return (
    <View style={styles.container}>
      <View style={styles.centeredGroup}>
        <Text style={styles.title}>{events.find((event) => event.id === attempt.result.eventId)?.name} Round {roundNumber}</Text>
        <Text style={styles.subtitle}>Competitor: {attempt?.result.person.name}</Text>
        <Text style={styles.subtitle}>Attempt: {attempt.attemptNumber}</Text>
        <Text style={styles.subtitle}>Judge: {attempt.judge.name}</Text>
        <View style={styles.separator} />
      </View>
      <View style={styles.leftGroup}>
        <View style={styles.formGroup}>
          <Text style={styles.label}>Time</Text>
          <TextInput
            placeholderTextColor={placeholderTextColor}
            selectionColor={cursorColor}
            style={styles.input}
            placeholder="Time"
            value={attempt.value.toString()}
            onChangeText={(value: string) => setAttempt({ ...attempt, value: +value })}
          />
        </View>
        <View style={styles.formGroup}>
          <View style={styles.selectContainer}>
            <Picker
              itemStyle={styles.pickerItem}
              style={styles.select}
              selectedValue={attempt.penalty.toString()}
              onValueChange={(value: string) => setAttempt({ ...attempt, penalty: +value })}
            >
              <Picker.Item label="No penalty" value="0" />
              <Picker.Item label={"+2"} value={"2"} />
              <Picker.Item label={"DNF"} value={"-1"} />
              <Picker.Item label={"+4"} value={"4"} />
              <Picker.Item label={"+6"} value={"6"} />
              <Picker.Item label={"+8"} value={"8"} />
              <Picker.Item label={"+10"} value={"10"} />
              <Picker.Item label={"+12"} value={"12"} />
              <Picker.Item label={"+14"} value={"14"} />
              <Picker.Item label={"+16"} value={"16"} />
            </Picker>
          </View>
        </View>
        <View style={styles.checkboxGroup}>
          <Checkbox
            style={styles.checkbox}
            value={attempt.isResolved}
            onValueChange={(value: boolean) => setAttempt({ ...attempt, isResolved: value })}
          />
          <Text style={styles.checkboxLabel}>Is resolved</Text>
        </View>
        <View style={styles.checkboxGroup}>
          <Checkbox
            style={styles.checkbox}
            value={attempt.extraGiven}
            onValueChange={(value: boolean) => setAttempt({ ...attempt, extraGiven: value })}
          />
          <Text style={styles.checkboxLabel}>Give extra</Text>
        </View>
      </View>
      <View style={styles.centeredGroup}>
        <Pressable style={styles.saveButton} onPress={handleSubmit}>
          <Text style={styles.buttonText}>Save</Text>
        </Pressable>
      </View>
      <StatusBar style={Platform.OS === 'ios' ? 'light' : 'auto'} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
  },
  centeredGroup: {
    alignItems: 'center',
    marginBottom: 20,
  },
  leftGroup: {
    alignItems: 'flex-start',
    paddingHorizontal: 20,
  },
  loadingText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: 'white',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: 'white',
    marginBottom: 5,
  },
  subtitle: {
    fontSize: 18,
    color: 'white',
  },
  separator: {
    marginVertical: 20,
    height: 1,
    width: '80%',
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  formGroup: {
    marginBottom: 15,
    width: '100%',
  },
  label: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 16,
    marginBottom: 5,
  },
  input: {
    borderWidth: 2,
    borderColor: 'white',
    paddingVertical: 10,
    paddingHorizontal: 15,
    borderRadius: 5,
    color: 'white',
  },
  selectContainer: {
    borderWidth: 2,
    borderColor: 'white',
    borderRadius: 5,
    marginTop: 5,
  },
  pickerItem: {
    color: 'white',
  },
  select: {
    color: 'white',
  },
  checkboxGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  checkbox: {
    alignSelf: 'center',
  },
  checkboxLabel: {
    color: 'white',
    marginLeft: 10,
  },
  saveButton: {
    backgroundColor: '#16a34a',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 5,
  },
  buttonText: {
    color: 'white',
    fontWeight: 'bold',
    textAlign: 'center',
  },
});
