import 'dart:convert';
import 'dart:io';
import 'package:http/http.dart' as http;
import 'package:session_storage/session_storage.dart';
import 'api.dart';
import 'user.dart';

class Round {
  final String id;
  final String name;

  Round({
    required this.id,
    required this.name,
  });

  static Future<List<Round>> fetchAll() async {
    final String jwt = (await User.getToken())!;
    final res = await http
        .get(Uri.parse('$BACKEND_ORIGIN/competition/rounds'), headers: {
      HttpHeaders.authorizationHeader: 'Bearer $jwt',
    });
    if (res.statusCode == 401) {
      final session = SessionStorage();
      session.clear();
    }
    if (!res.ok) {
      throw "Failed to fetch rounds";
    }
    var json = jsonDecode(res.body);

    List<Round> rounds = [];
    for (int i = 0; i < json.length; i++) {
      rounds.add(fromDynamic(json[i]));
    }
    return rounds;
  }

  static Round fromDynamic(dynamic json) {
    return Round(
      id: json['id'],
      name: json['name'],
    );
  }
}