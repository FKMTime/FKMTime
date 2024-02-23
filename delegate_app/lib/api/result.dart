import 'dart:convert';
import 'dart:io';
import 'package:http/http.dart' as http;
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'api.dart';
import 'person.dart';
import 'user.dart';

class Result {
  int id;
  String eventId;
  String roundId;
  String groupId;
  DateTime createdAt;
  DateTime updatedAt;
  Person person;

  Result({
    required this.id,
    required this.eventId,
    required this.roundId,
    required this.groupId,
    required this.createdAt,
    required this.updatedAt,
    required this.person,
  });

  static Future<List<Result>> fetchResultsFromRound(String id) async {
    final String jwt = (await User.getToken())!;
    final res =
        await http.get(Uri.parse('$BACKEND_ORIGIN/result/round/$id'), headers: {
      HttpHeaders.authorizationHeader: 'Bearer $jwt',
    });
    if (res.statusCode == 401) {
      var storage = const FlutterSecureStorage();
      await storage.deleteAll();
    }
    if (!res.ok) {
      throw "Failed to fetch results";
    }
    var json = jsonDecode(res.body);

    List<Result> results = [];
    for (int i = 0; i < json.length; i++) {
      results.add(fromDynamic(json[i]));
    }
    return results;
  }

  static Result fromDynamic(dynamic json) {
    return Result(
      id: json['id'],
      eventId: json['eventId'],
      roundId: json['roundId'],
      groupId: json['groupId'],
      createdAt: DateTime.parse(json['createdAt']),
      updatedAt: DateTime.parse(json['updatedAt']),
      person: Person.fromDynamic(json['person']),
    );
  }
}