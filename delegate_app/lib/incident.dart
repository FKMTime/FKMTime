import 'package:delegate_app/types.dart';
import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

const List<String> commentOptions = ['none', 'a7g', 'other'];

class IncidentPage extends StatefulWidget {
  final String caseId;

  const IncidentPage({super.key, required this.caseId});

  @override
  _IncidentPageState createState() => _IncidentPageState();
}

class _IncidentPageState extends State<IncidentPage> {
  late Attempt attempt;
  bool reSubmitToWcaLive = false;

  @override
  void initState() {
    super.initState();
    fetchData();
  }

  Future<void> fetchData() async {
    final parsedId = int.parse(widget.caseId);
    attempt = await Attempt.fetchById(parsedId);
    setState(() {});
  }

  Future<void> handleSubmit() async {
    final ok = await attempt.update(reSubmitToWcaLive);
    if (ok) {
      context.go('/');
      showDialog(
        context: context,
        builder: (context) => AlertDialog(
          content: const Text('Saved!'),
          actions: [
            TextButton(
              onPressed: () => Navigator.of(context).pop(),
              child: const Text('OK'),
            ),
          ],
        ),
      );
    } else {
      showDialog(
        context: context,
        builder: (context) => AlertDialog(
          content: const Text('Something went wrong!'),
          actions: [
            TextButton(
              onPressed: () => Navigator.of(context).pop(),
              child: const Text('OK'),
            ),
          ],
        ),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    if (attempt == null) {
      return const Scaffold(
        body: Center(
          child: Text(
            'Loading...',
            style: TextStyle(
                fontSize: 20, fontWeight: FontWeight.bold, color: Colors.white),
          ),
        ),
      );
    }

    final roundNumber = attempt.result.roundId.split('-r')[1];

    return Scaffold(
      appBar: AppBar(
        title: const Text('Incident'),
        actions: [
          IconButton(
            onPressed: () async {
              context.go('/');
            },
            icon: const Icon(Icons.home),
          ),
        ],
      ),
      body: Container(
        padding: const EdgeInsets.all(20),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.start,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              '${events.firstWhere((event) => event.id == attempt.result.eventId)?.name} Round $roundNumber',
              style: const TextStyle(
                  fontSize: 24,
                  fontWeight: FontWeight.bold,
                  color: Colors.white),
            ),
            Text('Competitor: ${attempt?.result.person.name}',
                style: const TextStyle(fontSize: 18, color: Colors.white)),
            Text('Attempt: ${attempt.attemptNumber}',
                style: const TextStyle(fontSize: 18, color: Colors.white)),
            Text('Judge: ${attempt.judge.name}',
                style: const TextStyle(fontSize: 18, color: Colors.white)),
            const SizedBox(height: 20),

            const Text(
              'Time',
              style: TextStyle(fontSize: 18, color: Colors.white),
            ),
            TextFormField(
              style: const TextStyle(color: Colors.white),
              keyboardType: TextInputType.number,
              initialValue: attempt.value.toString(),
              onChanged: (value) {
                print(value);
                attempt.value = int.parse(value);
              },
            ),
            const SizedBox(height: 10),

            // Dropdown for penalty
            const Text(
              'Penalty',
              style: TextStyle(fontSize: 18, color: Colors.white),
            ),
            DropdownButton<String>(
              value: attempt.penalty.toString(),
              onChanged: (String? value) {
                setState(() {
                  attempt.penalty = int.parse(value!);
                });
              },
              items: const [
                DropdownMenuItem(value: "0", child: Text("No penalty")),
                DropdownMenuItem(value: "2", child: Text("+2")),
                DropdownMenuItem(value: "-1", child: Text("DNF")),
                DropdownMenuItem(value: "4", child: Text("+4")),
                DropdownMenuItem(value: "6", child: Text("+6")),
                DropdownMenuItem(value: "8", child: Text("+8")),
                DropdownMenuItem(value: "10", child: Text("+10")),
                DropdownMenuItem(value: "12", child: Text("+12")),
                DropdownMenuItem(value: "16", child: Text("+16")),
              ],
            ),
            const SizedBox(height: 10),

            const Text(
              'Comment',
              style: TextStyle(fontSize: 18, color: Colors.white),
            ),
            TextFormField(
              initialValue: attempt.comment,
              onChanged: (value) => attempt.comment = value,
              style: const TextStyle(color: Colors.white),
              decoration: const InputDecoration(
                hintText: 'Comment',
                hintStyle: TextStyle(color: Colors.white),
              ),
            ),
            Row(
              children: [
                Checkbox(
                  value: attempt.isResolved,
                  onChanged: (bool? value) {
                    setState(() {
                      attempt.isResolved = value!;
                    });
                  },
                ),
                const Text('Is resolved',
                    style: TextStyle(fontSize: 18, color: Colors.white)),
              ],
            ),
            const SizedBox(height: 10),

            // Checkbox for extraGiven
            Row(
              children: [
                Checkbox(
                  value: attempt.extraGiven,
                  onChanged: (bool? value) {
                    setState(() {
                      attempt.extraGiven = value!;
                    });
                  },
                ),
                const Text('Give extra',
                    style: TextStyle(fontSize: 18, color: Colors.white)),
              ],
            ),
            Row(
              children: [
                Checkbox(
                  value: reSubmitToWcaLive,
                  onChanged: (bool? value) {
                    setState(() {
                      reSubmitToWcaLive = value!;
                    });
                  },
                ),
                const Text('Resubmit to WCA Live',
                    style: TextStyle(fontSize: 18, color: Colors.white)),
              ],
            ),
            const SizedBox(height: 20),
            // Save button
            ElevatedButton(
              onPressed: handleSubmit,
              child: const Text('Save'),
            ),
          ],
        ),
      ),
    );
  }
}
