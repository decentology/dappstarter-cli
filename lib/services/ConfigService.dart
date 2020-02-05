import 'dart:convert';
import 'dart:io';
import 'package:dappstarter_cli/models/config.dart';

class ConfigService {
  static Future<Config> getLocalFile(String path) async {
    if ((await FileSystemEntity.type(path)) == FileSystemEntityType.notFound) {
      print('[Error] Configuration file not found.');
      return null;
    }
    var data = Config.fromJson(jsonDecode(await File(path).readAsString()));

    return data;
  }

  static Future<void> writeConfig(
      String path, String dappName, Map<String, dynamic> options) async {
    final body = jsonEncode({'name': dappName, 'blocks': options});
    final outFile = await File(path).create(recursive: true);

    await outFile.writeAsString(body);
  }
}
