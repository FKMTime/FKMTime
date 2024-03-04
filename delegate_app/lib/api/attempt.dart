import 'dart:convert';
import 'dart:io';
import 'package:http/http.dart' as http;
import 'api.dart';
import 'person.dart';
import 'station.dart';
import 'result.dart';
import 'user.dart';
import 'package:session_storage/session_storage.dart';

class Attempt {
  int id;
  int resultId;
  int attemptNumber;
  int? replacedBy;
  bool isDelegate;
  bool isResolved;
  int penalty;
  bool isExtraAttempt;
  bool extraGiven;
  DateTime createdAt;
  int value;
  String? comment;
  Person judge;
  Station station;
  Result result;

  Attempt({
    required this.id,
    required this.resultId,
    required this.attemptNumber,
    required this.replacedBy,
    required this.isDelegate,
    required this.isResolved,
    required this.penalty,
    required this.isExtraAttempt,
    required this.extraGiven,
    required this.createdAt,
    required this.value,
    required this.judge,
    required this.station,
    required this.result,
    required this.comment,
  });

  // Do not invoke if user is not logged in!!!
  static Future<List<Attempt>> fetchAll() async {
    final String jwt = (await User.getToken())!;
    final res = await http
        .get(Uri.parse('$BACKEND_ORIGIN/attempt/unresolved'), headers: {
      HttpHeaders.authorizationHeader: 'Bearer $jwt',
    });
    if (res.statusCode == 401) {
      final session = SessionStorage();
      session.clear();
    }
    if (!res.ok) {
      throw "Failed to fetch cases";
    }
    var json = jsonDecode(res.body);

    List<Attempt> attempts = [];
    for (int i = 0; i < json.length; i++) {
      attempts.add(fromDynamic(json[i]));
    }
    return attempts;
  }

  static Future<List<Attempt>> fetchAttemptsByResultId(int id) async {
    final String jwt = (await User.getToken())!;
    final res = await http
        .get(Uri.parse('$BACKEND_ORIGIN/result/$id/attempts'), headers: {
      HttpHeaders.authorizationHeader: 'Bearer $jwt',
    });

    if (!res.ok) {
      throw "Failed to fetch result";
    }
    var json = jsonDecode(res.body);
    List<Attempt> attempts = [];
    for (int i = 0; i < json.length; i++) {
      attempts.add(fromDynamic(json[i]));
    }

    return attempts;
  }

  static Future<Attempt> fetchById(int id) async {
    final String jwt = (await User.getToken())!;
    final res =
        await http.get(Uri.parse('$BACKEND_ORIGIN/attempt/$id'), headers: {
      HttpHeaders.authorizationHeader: 'Bearer $jwt',
    });
    if (!res.ok) {
      throw "Failed to fetch case";
    }
    var json = jsonDecode(res.body);
    return fromDynamic(json);
  }

  Future<bool> update(bool resubmitToWcaLive) async {
    final String jwt = (await User.getToken())!;
    final replacedBy = this.replacedBy ?? 0;
    final body = {
      'replacedBy': replacedBy.toString(),
      'isDelegate': isDelegate,
      'isResolved': isResolved,
      'penalty': penalty.toString(),
      'attemptNumber': attemptNumber.toString(),
      'isExtraAttempt': isExtraAttempt,
      'extraGiven': extraGiven,
      'comment': comment ?? '',
      'value': value.toString(),
      'judgeId': judge.id.toString(),
      'stationId': station.id.toString(),
      'resultId': result.id.toString(),
      'submitToWcaLive': resubmitToWcaLive,
    };

    final res = await http.put(Uri.parse('$BACKEND_ORIGIN/attempt/$id'),
        headers: {
          HttpHeaders.contentTypeHeader: "application/json",
          HttpHeaders.authorizationHeader: 'Bearer $jwt',
        },
        body: jsonEncode(body));

    if (!res.ok) {
      throw "Failed to update case";
    }
    return true;
  }

  static Attempt fromDynamic(dynamic json) {
    return Attempt(
      id: json['id'],
      resultId: json['resultId'],
      attemptNumber: json['attemptNumber'],
      replacedBy: json['replacedBy'],
      isDelegate: json['isDelegate'],
      isResolved: json['isResolved'],
      penalty: json['penalty'],
      isExtraAttempt: json['isExtraAttempt'],
      extraGiven: json['extraGiven'],
      comment: json['comment'],
      createdAt: DateTime.parse(json['createdAt']),
      value: json['value'],
      judge: Person.fromDynamic(json['judge']),
      station: Station.fromDynamic(json['station']),
      result: Result.fromDynamic(json['result']),
    );
  }
}
