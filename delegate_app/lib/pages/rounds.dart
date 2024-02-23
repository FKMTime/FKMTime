import 'package:flutter/material.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:go_router/go_router.dart';
import 'package:delegate_app/components/loading.dart';
import 'package:delegate_app/api/round.dart';
import 'package:delegate_app/api/user.dart';

class RoundsPage extends StatefulWidget {
  RoundsPage({super.key});

  bool isUserLoggedIn = true;

  @override
  State<RoundsPage> createState() => _RoundsPageState();
}

class _RoundsPageState extends State<RoundsPage> {
  @override
  Widget build(BuildContext context) {
    return FutureBuilder(
      future: () async {
        widget.isUserLoggedIn = await User.getToken() != null;
        if (widget.isUserLoggedIn) {
          return Round.fetchAll();
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

    for (Round round in snapshot.data) {
      cards.add(RoundCard(
        id: round.id,
        name: round.name,
      ));
    }

    return Scaffold(
      appBar: AppBar(
        title: const Text('FKM Time'),
        actions: [
          IconButton(
            onPressed: () async {
              context.go('/');
            },
            icon: const Icon(Icons.home),
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
                rounds(cards, snapshot),
              ],
            ),
          ),
        ),
      ),
    );
  }

  Widget rounds(List<Widget> cards, AsyncSnapshot snapshot) {
    if (cards.isEmpty) {
      return const Text("No rounds", style: TextStyle(fontSize: 20));
    } else {
      return Wrap(
        children: cards,
      );
    }
  }
}

class RoundCard extends StatelessWidget {
  const RoundCard({super.key, required this.id, required this.name});
  final String id;
  final String name;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: () {
        context.go('/rounds/$id');
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
            height: 50,
            child: Column(
              mainAxisAlignment: MainAxisAlignment.spaceEvenly,
              children: [
                Text(
                  name,
                  style: const TextStyle(
                    color: Colors.white,
                    fontSize: 20,
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
