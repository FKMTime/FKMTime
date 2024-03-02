import 'dart:convert';
import 'dart:io';
import 'package:http/http.dart' as http;
import 'package:session_storage/session_storage.dart';
import 'api.dart';

class User {
  String token;
  UserInfo? info;

  User({
    required this.token,
    this.info,
  });

  Future<void> saveToken() async {
    final session = SessionStorage();
    session['token'] = token;
  }

  static Future<String?> getToken() async {
    final session = SessionStorage();
    return session['token'];
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