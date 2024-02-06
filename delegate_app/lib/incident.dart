import 'package:delegate_app/types.dart';
import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

class IncidentPage extends StatefulWidget {
  final String caseId;

  const IncidentPage({super.key, required this.caseId});

  @override
  _IncidentPageState createState() => _IncidentPageState();
}

class _IncidentPageState extends State<IncidentPage> {
  late Attempt attempt;

  @override
  void initState() {
    super.initState();
    fetchData();
  }

  Future<void> fetchData() async {
    // Implement your data fetching logic here
    // Replace the following line with your actual logic
    final parsedId = int.parse(widget.caseId);
    attempt = await Attempt.fetchById(parsedId);
    setState(() {});
  }

  Future<void> handleSubmit() async {
    if (attempt == null) return;
    // Implement your submission logic here
    // Replace the following line with your actual logic
    final status = await attempt.update();
    if (status == 200) {
      GoRouter.of(context).go('/');
      showDialog(
        context: context,
        builder: (context) => AlertDialog(
          content: Text('Saved!'),
          actions: [
            TextButton(
              onPressed: () => Navigator.of(context).pop(),
              child: Text('OK'),
            ),
          ],
        ),
      );
    } else {
      showDialog(
        context: context,
        builder: (context) => AlertDialog(
          content: Text('Something went wrong!'),
          actions: [
            TextButton(
              onPressed: () => Navigator.of(context).pop(),
              child: Text('OK'),
            ),
          ],
        ),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    if (attempt == null) {
      return Scaffold(
        body: Center(
          child: Text(
            'Loading...',
            style: TextStyle(fontSize: 20, fontWeight: FontWeight.bold, color: Colors.white),
          ),
        ),
      );
    }

    final roundNumber = attempt.result.roundId.split('-r')[1];

    return Scaffold(
      body: Container(
        padding: EdgeInsets.all(20),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              '${events.firstWhere((event) => event.id == attempt.result.eventId)?.name} Round $roundNumber',
              style: TextStyle(fontSize: 24, fontWeight: FontWeight.bold, color: Colors.white),
            ),
            Text('Competitor: ${attempt?.result.person.name}', style: TextStyle(fontSize: 18, color: Colors.white)),
            Text('Attempt: ${attempt.attemptNumber}', style: TextStyle(fontSize: 18, color: Colors.white)),
            Text('Judge: ${attempt.judge.name}', style: TextStyle(fontSize: 18, color: Colors.white)),
            SizedBox(height: 20),
            // Add the rest of your UI components here
          ],
        ),
      ),
    );
  }
}
