import 'dart:convert';
import 'dart:io';
import 'package:archive/archive.dart';
import 'package:console/console.dart';
import 'package:dappstarter_cli/models/processResult.dart';
import 'package:dappstarter_cli/settings.dart';
import 'package:http/http.dart';
import 'package:dappstarter_cli/models/manifest.dart';
import 'package:path/path.dart';

class DappStarterService {
  static final String _currentDirectory = basename(Directory.current.path);
  static Future<List<Manifest>> getManifest() async {
    Response response;
    try {
      response = await get('${Settings().hostUrl}/manifest');
    } catch (e) {
      TextPen()
        ..red()
        ..text('${Icon.HEAVY_BALLOT_X} Unable to to fetch Dappstarter manifest')
            .print();
      return null;
    }

    if (response.statusCode == 200) {
      var manifestList = (jsonDecode(response.body) as Iterable)
          .map((model) => Manifest.fromJson(model))
          .toList();
      return manifestList;
    }
    return null;
  }

  static Future<void> postSelections(
      String outputPath, String dappName, Map<String, dynamic> options) async {
    final body = jsonEncode({'name': dappName, 'blocks': options});

    Response response;
    try {
      response = await post('${Settings().hostUrl}/process?github=false',
          headers: {'Content-Type': 'application/json'}, body: body);
    } catch (e) {
      TextPen()
        ..red()
        ..text('${Icon.HEAVY_BALLOT_X} Unable to proess configuration').print();
      return;
    }
    if (response.statusCode == 201) {
      final processResult = ProcessResult.fromJson(jsonDecode(response.body));

      final zipResponse = await get(processResult.url);
      final archive = ZipDecoder().decodeBytes(zipResponse.bodyBytes);
      var outputDirectory =
          _currentDirectory != 'dappstarter-cli' ? _currentDirectory : 'out';
      if (outputPath != null) {
        outputDirectory = outputPath;
      }

      for (final file in archive) {
        final filename = file.name;
        if (file.isFile) {
          final data = file.content as List<int>;
          final outFile = await File(join(outputDirectory, filename))
              .create(recursive: true);
          await outFile.writeAsBytes(data);
        } else {
          await Directory(join(outputDirectory, filename))
              .create(recursive: true);
        }
      }
    }
  }
}
