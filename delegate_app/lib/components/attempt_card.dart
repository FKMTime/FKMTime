import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:delegate_app/utils/result_utils.dart';

class AttemptCard extends StatelessWidget {
  const AttemptCard(
      {super.key,
      required this.attemptNumber,
      required this.value,
      required this.stationName,
      required this.isExtraAttempt,
      required this.judgeName,
      required this.id});
  final String attemptNumber;
  final int value;
  final String stationName;
  final String judgeName;
  final int id;
  final bool isExtraAttempt;

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
            height: 150,
            child: Column(
              mainAxisAlignment: MainAxisAlignment.spaceEvenly,
              children: [
                Text(
                  "Attempt: $attemptNumber ${isExtraAttempt ? '(Extra)' : ''}",
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
