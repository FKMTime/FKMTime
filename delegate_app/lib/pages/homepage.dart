import 'package:flutter/material.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:go_router/go_router.dart';
import 'package:delegate_app/components/incident_card.dart';
import 'package:delegate_app/components/loading.dart';
import 'package:delegate_app/api/attempt.dart';
import 'package:delegate_app/api/user.dart';
import 'package:delegate_app/api/event.dart';

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
      return const Loading();
    }
    if (!widget.isUserLoggedIn) {
      context.go('/login');
    }

    List<Widget> cards = [];

    for (Attempt incident in snapshot.data) {
      final String eventName = events.getById(incident.result.eventId).name;
      cards.add(IncidentCard(
        id: incident.id,
        eventName:
            '$eventName round ${incident.result.roundId.split("-r").last}',
        competitorName: incident.result.person.name,
        attemptNumber: incident.attemptNumber.toString(),
        value: incident.value,
        stationName: incident.station.name,
        judgeName: incident.judge.name,
      ));
    }

    return Scaffold(
      appBar: AppBar(
        title: const Text('FKM Time'),
        actions: [
          IconButton(
            onPressed: () async {
              context.go('/rounds');
            },
            icon: const Icon(Icons.bar_chart_sharp),
          ),
          IconButton(
            onPressed: () async {
              context.go('/settings');
            },
            icon: const Icon(Icons.settings),
          ),
          IconButton(
            onPressed: () async {
              setState(() {});
            },
            icon: const Icon(Icons.refresh),
          ),
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
              children: [
                incidents(cards, snapshot),
              ],
            ),
          ),
        ),
      ),
    );
  }

  Widget incidents(List<Widget> cards, AsyncSnapshot snapshot) {
    if (cards.isEmpty) {
      return const Text("No incidents", style: TextStyle(fontSize: 20));
    } else {
      return Wrap(
        children: cards,
      );
    }
  }
}
