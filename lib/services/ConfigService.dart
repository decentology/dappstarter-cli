import 'dart:convert';
import 'dart:io';
import 'package:console/console.dart';
import 'package:dappstarter_cli/models/config.dart';

class ConfigService {
  static Future<Config> getLocalFile(String path) async {
    if ((await FileSystemEntity.type(path)) == FileSystemEntityType.notFound) {
      TextPen()
        ..red()
        ..text('${Icon.HEAVY_BALLOT_X} Configuration file not found.').print();
      return null;
    }
    try {
      var data = Config.fromJson(jsonDecode(await File(path).readAsString()));
      return data;
    } catch (e) {
      TextPen()
        ..red()
        ..text('${Icon.HEAVY_BALLOT_X} Unable to parse configuration file.')
            .print();
    }
    return null;
  }

  static Future<void> writeConfig(
      String path, String dappName, Map<String, dynamic> options) async {
    final body = jsonEncode({'name': dappName, 'blocks': options});
    final outFile = await File(path).create(recursive: true);

    await outFile.writeAsString(body);
  }
}
