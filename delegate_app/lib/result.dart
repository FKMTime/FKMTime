import 'package:delegate_app/types.dart';
import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'attempt_card.dart';
import 'loading.dart';

class ResultPage extends StatefulWidget {
  final String resultId;

  const ResultPage({super.key, required this.resultId});

  @override
  State<ResultPage> createState() => _ResultPageState();
}

class _ResultPageState extends State<ResultPage> {
  @override
  Widget build(BuildContext context) {
    return FutureBuilder(
      future: () async {
        final token = await User.getToken() != null;
        if (token) {
          return Attempt.fetchAttemptsByResultId(int.parse(widget.resultId));
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

    for (Attempt attempt in snapshot.data) {
      cards.add(AttemptCard(
        id: attempt.id,
        isExtraAttempt: attempt.isExtraAttempt,
        attemptNumber: attempt.attemptNumber.toString(),
        value: attempt.value,
        stationName: attempt.station.name,
        judgeName: attempt.judge.name,
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
                attempts(cards, snapshot),
              ],
            ),
          ),
        ),
      ),
    );
  }

  Widget attempts(List<Widget> cards, AsyncSnapshot snapshot) {
    if (cards.isEmpty) {
      return const Text("No attempts", style: TextStyle(fontSize: 20));
    } else {
      return Wrap(
        children: cards,
      );
    }
  }
}
