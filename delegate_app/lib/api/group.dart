import 'dart:convert';
import 'dart:io';
import 'package:http/http.dart' as http;
import 'package:session_storage/session_storage.dart';
import 'api.dart';
import 'user.dart';

class Group {
  String name;
  String groupId;
  String eventId;
  String roundId;
  bool isCurrent;

  Group({
    required this.name,
    required this.groupId,
    required this.eventId,
    required this.roundId,
    required this.isCurrent,
  });

  static Future<List<Group>> fetchAllGroups() async {
    final String jwt = (await User.getToken())!;
    final res = await http
        .get(Uri.parse('$BACKEND_ORIGIN/competition/groups'), headers: {
      HttpHeaders.authorizationHeader: 'Bearer $jwt',
    });
    if (res.statusCode == 401) {
      final session = SessionStorage();
      session.clear();
    }
    if (!res.ok) {
      throw "Failed to fetch groups";
    }
    var json = jsonDecode(res.body);

    List<Group> groups = [];
    for (int i = 0; i < json.length; i++) {
      groups.add(fromDynamic(json[i]));
    }
    return groups;
  }

  static Future<bool> updateCurrentGroup(String groupId) async {
    final String jwt = (await User.getToken())!;
    final res = await http.get(
      Uri.parse('$BACKEND_ORIGIN/competition/groups/$groupId'),
      headers: {
        HttpHeaders.authorizationHeader: 'Bearer $jwt',
      },
    );
    if (res.statusCode == 401) {
      final session = SessionStorage();
      session.clear();
    }
    if (!res.ok) {
      throw "Failed to update current group";
    }
    return true;
  }

  static Group fromDynamic(dynamic json) {
    return Group(
      name: json['name'],
      groupId: json['groupId'],
      eventId: json['eventId'],
      roundId: json['roundId'],
      isCurrent: json['isCurrent'],
    );
  }
}
