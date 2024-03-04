import 'package:delegate_app/utils/result_utils.dart';
import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

class IncidentCard extends StatelessWidget {
  const IncidentCard(
      {super.key,
      required this.eventName,
      required this.attemptNumber,
      required this.value,
      required this.stationName,
      required this.judgeName,
      required this.competitorName,
      required this.id});
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
                  "Time: ${ResultUtils.resultToString(value)}",
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
