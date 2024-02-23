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
