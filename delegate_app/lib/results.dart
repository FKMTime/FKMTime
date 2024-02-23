import 'package:delegate_app/types.dart';
import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import 'loading.dart';

class ResultsPage extends StatefulWidget {
  final String roundId;

  const ResultsPage({super.key, required this.roundId});

  @override
  State<ResultsPage> createState() => _ResultsPageState();
}

class _ResultsPageState extends State<ResultsPage> {
  @override
  Widget build(BuildContext context) {
    return FutureBuilder(
      future: () async {
        final token = await User.getToken() != null;
        if (token) {
          return Result.fetchResultsFromRound(widget.roundId);
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

    List<Widget> cards = [];

    for (Result result in snapshot.data) {
      cards.add(ResultCard(
        id: result.id,
        personName: result.person.name,
      ));
    }

    return Scaffold(
      appBar: AppBar(
        title: const Text('FKM Time'),
        actions: [
          IconButton(
            onPressed: () async {
              setState(() {});
            },
            icon: const Icon(Icons.refresh),
          ),
          IconButton(
            onPressed: () async {
              context.go('/');
            },
            icon: const Icon(Icons.home),
          ),
        ],
      ),
      body: SingleChildScrollView(
        child: Center(
          child: Padding(
            padding: const EdgeInsets.symmetric(vertical: 50),
            child: Wrap(
              children: [
                results(cards, snapshot),
              ],
            ),
          ),
        ),
      ),
    );
  }

  Widget results(List<Widget> cards, AsyncSnapshot snapshot) {
    if (cards.isEmpty) {
      return const Text("No results", style: TextStyle(fontSize: 20));
    } else {
      return Wrap(
        children: cards,
      );
    }
  }
}

class ResultCard extends StatelessWidget {
  const ResultCard({super.key, required this.personName, required this.id});
  final int id;
  final String personName;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: () {
        context.go('/results/$id');
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
                  personName,
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
