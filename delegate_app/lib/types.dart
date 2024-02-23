import 'dart:convert';
import 'dart:ffi';
import 'dart:io';
import 'package:http/http.dart' as http;
import 'package:flutter_secure_storage/flutter_secure_storage.dart';

const BACKEND_ORIGIN = 'http://localhost:5000';

extension IsOk on http.Response {
  bool get ok {
    int firstDigit = (statusCode ~/ 100);
    return firstDigit == 2 || firstDigit == 3;
  }
}

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
      var storage = const FlutterSecureStorage();
      await storage.deleteAll();
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

class Station {
  int id;
  String name;

  Station({
    required this.id,
    required this.name,
  });

  static Station fromDynamic(dynamic json) {
    return Station(
      id: json['id'],
      name: json['name'],
    );
  }
}

class Person {
  int id;
  int registrantId;
  String name;
  String? wcaId;

  Person({
    required this.id,
    required this.registrantId,
    required this.name,
    this.wcaId,
  });

  static Person fromDynamic(dynamic json) {
    return Person(
      id: json['id'],
      registrantId: json['registrantId'],
      name: json['name'],
      wcaId: json['wcaId'],
    );
  }
}

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

class User {
  String token;
  UserInfo? info;

  User({
    required this.token,
    this.info,
  });

  Future<void> saveToken() async {
    const storage = FlutterSecureStorage();
    await storage.write(key: 'token', value: token);
  }

  static Future<String?> getToken() async {
    const storage = FlutterSecureStorage();
    return await storage.read(key: 'token');
  }

  static Future<User> login(String username, String password) async {
    final res = await http.post(Uri.parse('$BACKEND_ORIGIN/auth/login'), body: {
      'username': username,
      'password': password,
    });
    if (!res.ok) {
      throw "Failed to login";
    }
    var json = jsonDecode(res.body);
    return fromDynamic(json);
  }

  static Future<void> updateNotificationToken(String? token) async {
    final String jwt = (await getToken())!;
    final res =
        await http.put(Uri.parse('$BACKEND_ORIGIN/user/notification-token'),
            headers: {
              HttpHeaders.contentTypeHeader: "application/json",
              HttpHeaders.authorizationHeader: 'Bearer $jwt',
            },
            body: jsonEncode({'token': token}));

    if (!res.ok) {
      throw "Failed to update notification token";
    }
  }

  static User fromDynamic(dynamic json) {
    return User(
      token: json['token'],
      info: UserInfo(
        id: json['userInfo']['id'],
        username: json['userInfo']['username'],
        role: json['userInfo']['role'],
      ),
    );
  }
}

class UserInfo {
  int id;
  String username;
  String role;

  UserInfo({
    required this.id,
    required this.username,
    required this.role,
  });
}

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
      var storage = const FlutterSecureStorage();
      await storage.deleteAll();
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

class Event {
  final String id;
  final String name;

  Event({
    required this.id,
    required this.name,
  });
}

extension GetById on List<Event> {
  Event getById(String id) {
    return firstWhere((event) => event.id == id);
  }
}

final List<Event> events = [
  Event(id: "333", name: "3x3x3 Cube"),
  Event(id: "222", name: "2x2x2 Cube"),
  Event(id: "444", name: "4x4x4 Cube"),
  Event(id: "555", name: "5x5x5 Cube"),
  Event(id: "666", name: "6x6x6 Cube"),
  Event(id: "777", name: "7x7x7 Cube"),
  Event(id: "333bf", name: "3x3x3 Blindfolded"),
  Event(id: "333fm", name: "3x3x3 Fewest Moves"),
  Event(id: "333oh", name: "3x3x3 One-Handed"),
  Event(id: "minx", name: "Megaminx"),
  Event(id: "pyram", name: "Pyraminx"),
  Event(id: "clock", name: "Clock"),
  Event(id: "skewb", name: "Skewb"),
  Event(id: "sq1", name: "Square-1"),
  Event(id: "444bf", name: "4x4x4 Blindfolded"),
  Event(id: "555bf", name: "5x5x5 Blindfolded"),
  Event(id: "333mbf", name: "3x3x3 Multi-Blind"),
];
