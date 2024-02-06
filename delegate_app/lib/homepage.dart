import 'package:delegate_app/login.dart';
import 'package:delegate_app/types.dart';
import 'package:flutter/material.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:go_router/go_router.dart';

class HomePage extends StatefulWidget {
  HomePage({super.key});

  bool isUserLoggedIn = true;

  @override
  State<HomePage> createState() => _HomePageState();
}

class _HomePageState extends State<HomePage> {
  @override
  Widget build(BuildContext context) {
    return FutureBuilder(
      future: () async {
        widget.isUserLoggedIn = await User.getToken() != null;
        if (widget.isUserLoggedIn) {
          return Attempt.fetchAll();
        } else {
          return [];
        }
      }(),
      builder: _build,
    );
  }

  Widget _build(BuildContext context, AsyncSnapshot snapshot) {
    if (snapshot.hasError) {
      String err = snapshot.error.toString();
      return Scaffold(body: Text('An error occurred $err'));
    }
    if (!snapshot.hasData) {
      return const Text("Loading...");
    }
    if (!widget.isUserLoggedIn) {
      return LoginPage();
    }

    List<Widget> cards = [];

    for (Attempt incident in snapshot.data) {
      final String eventName = events.getById(incident.result.eventId).name;
      cards.add(Incident(
        id: incident.id,
        eventName: '$eventName round ${incident.result.roundId.split("-r").last}',
        competitorName: incident.result.person.name,
        attemptNumber: incident.attemptNumber.toString(),
        value: incident.value,
        stationName: incident.station.name,
        judgeName: incident.judge.name,
      ));
    }
  // add logout button
    return Scaffold(
      appBar: AppBar(
        title: const Text('FKM Time'),
        actions: [
          IconButton(
            onPressed: () async {
              var storage = const FlutterSecureStorage();
              await storage.deleteAll();
              setState(() {
                widget.isUserLoggedIn = false;
              });
            },
            icon: const Icon(Icons.logout),
          ),
        ],
      ),
      body: SingleChildScrollView(
        child: Center(
          child: Padding(
            padding: const EdgeInsets.symmetric(vertical: 50),
            child: Wrap(
              children: cards,
            ),
          ),
        ),
      ),
    );
  }
}

class Incident extends StatelessWidget {
  const Incident({super.key, required this.eventName, required this.attemptNumber, required this.value, required this.stationName, required this.judgeName, required this.competitorName, required this.id
  });
  final String eventName;
  final String attemptNumber;
  final int value;
  final String stationName;
  final String competitorName;
  final String judgeName;
  final int id;


  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: () {
        context.go('/incidents/$id');
      },
      child: Card(
        child: Padding(
          padding: const EdgeInsets.all(5),
          child: Container(
            decoration: BoxDecoration(
              color: Colors.teal,
              borderRadius: BorderRadius.circular(7),
            ),
            width: 300,
            height: 200,
            child: Column(
              mainAxisAlignment: MainAxisAlignment.spaceEvenly,
              children: [
                Text(
                  eventName,
                  style: const TextStyle(
                    color: Colors.white,
                    fontSize: 20,
                  ),
                ),
                Text(
                  "Competitor: $competitorName",
                  style: const TextStyle(
                    color: Colors.white,
                    fontSize: 15,
                  ),
                ),
                Text(
                  "Attempt: $attemptNumber",
                  style: const TextStyle(
                    color: Colors.white,
                    fontSize: 15,
                  ),
                ),
                Text(
                  "Value: $value",
                  style: const TextStyle(
                    color: Colors.white,
                    fontSize: 15,
                  ),
                ),
                Text(
                  "Station: $stationName",
                  style: const TextStyle(
                    color: Colors.white,
                    fontSize: 15,
                  ),
                ),
                Text(
                  "Judge: $judgeName",
                  style: const TextStyle(
                    color: Colors.white,
                    fontSize: 15,
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
