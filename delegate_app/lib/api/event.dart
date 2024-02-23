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
