import 'package:http/http.dart' as http;

const BACKEND_ORIGIN = 'http://localhost:5000';

extension IsOk on http.Response {
  bool get ok {
    int firstDigit = (statusCode ~/ 100);
    return firstDigit == 2 || firstDigit == 3;
  }
}