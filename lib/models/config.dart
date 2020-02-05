class Config {
  String name;
  Map<String, dynamic> blocks;

  Config.fromJson(Map<String, dynamic> json) {
    name = json['name'];
    blocks = json['blocks'];
  }
}
