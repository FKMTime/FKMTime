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