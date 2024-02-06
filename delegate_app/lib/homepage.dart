import 'package:delegate_app/login.dart';
import 'package:delegate_app/types.dart';
import 'package:flutter/material.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';

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
        //var storage = const FlutterSecureStorage();
        //await storage.deleteAll();

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
      cards.add(Incident(incidentName: incident.id.toString()));
    }

    return Scaffold(
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
  const Incident({super.key, required this.incidentName});

  final String incidentName;

  @override
  Widget build(BuildContext context) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(5),
        child: Container(
          decoration: BoxDecoration(
              color: Colors.teal, borderRadius: BorderRadius.circular(7)),
          width: 300,
          height: 100,
          child: Text(incidentName),
        ),
      ),
    );
  }
}
