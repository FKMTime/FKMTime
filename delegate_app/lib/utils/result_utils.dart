class ResultUtils {
  static String resultToString(int result) {
    if (result == -1) {
      return "DNF";
    }
    if (result == -2) {
      return "DNS";
    }
    return centisecondsToClockFormat(result).toString();
  }

  static String centisecondsToClockFormat(int centiseconds) {
    if (!centiseconds.isFinite) {
      throw ArgumentError(
          'Invalid centiseconds, expected positive number, got $centiseconds.');
    }

  final minutes = centiseconds ~/ 6000;
  final seconds = (centiseconds % 6000) ~/ 100;
  final tenths = (centiseconds % 6000) % 100;


    if (minutes == 0) {
      if (seconds == 0) {
        return '0.$tenths';
      }
      return '$seconds.$tenths';
    } else {
      return '${minutes.toString()}:${seconds}.${tenths}';
    }
  }

  static int? toInt(String string) {
    final number = int.tryParse(string);
    return number;
  }
}
