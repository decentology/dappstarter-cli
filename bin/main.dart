import 'dart:convert';
import 'dart:io';
import 'package:archive/archive.dart';
import 'package:args/command_runner.dart';
import 'package:dappstarter_cli/config.dart';
import 'package:dappstarter_cli/manifest.dart';
import 'package:dappstarter_cli/processResult.dart';
import 'package:http/http.dart' as http;
import 'package:path/path.dart';

void main(List<String> args) {
  var runner = CommandRunner('dappstarter', 'Full-Stack Blockchain App Mojo');
  runner..addCommand(DappStarterCommand());
  runner.run(args);
}

class DappStarterCommand extends Command {
  static const hostUrl = 'http://localhost:5001';

  @override
  String get description => 'Generate dappstarter';
  @override
  String get name => 'generate';

  DappStarterCommand() {
    argParser.addOption('config', abbr: 'c', help: 'Loads configuration from file and processes.');
    argParser.addOption('write-only', abbr: 'w', help: 'Writes configuration to file without processing.');
  }

  var options = <String, dynamic>{};
  String dappName = basename(Directory.current.path);

  @override
  void run() async {
    if (argResults['file'] != null) {
      // Read file
      var data = Config.fromJson(
          jsonDecode(await File(argResults['file']).readAsString()));
      print('Now initializing dapp: ${data.name}, blocks: ${data.blocks.length}');
      dappName = data.name;
      options = data.blocks;
      await postSelections(dappName, options);
      return;
    }

    final response = await http.get('$hostUrl/manifest');
    var manifestList = (jsonDecode(response.body) as Iterable)
        .map((model) => Manifest.fromJson(model))
        .toList();

    print('Enter name for your dapp ($dappName)');
    var result = stdin.readLineSync();
    if (result != '') {
      dappName = result;
    }
    for (var manifest in manifestList) {
      showMultiplePicker(manifest);
    }
    print('⚙ heart Your seletions ${options.toString()}');
    await writeConfig(dappName, options);
    await postSelections(dappName, options);
  }

  Future<void> writeConfig(
      String dappName, Map<String, dynamic> options) async {
    final body = jsonEncode({'name': dappName, 'blocks': options});
    final outFile = await File('out/config.json').create(recursive: true);

    await outFile.writeAsString(body);
  }

  void postSelections(String dappName, Map<String, dynamic> options) async {
    final body = jsonEncode({'name': dappName, 'blocks': options});

    final response = await http.post('$hostUrl/process?github=false',
        headers: {'Content-Type': 'application/json'}, body: body);
    if (response.statusCode == 201) {
      print('😲 Success!');
      final processResult = ProcessResult.fromJson(jsonDecode(response.body));

      final zipResponse = await http.get(processResult.url);
      final archive = ZipDecoder().decodeBytes(zipResponse.bodyBytes);

      // Extract this as a method
      for (final file in archive) {
        final filename = file.name;
        if (file.isFile) {
          final data = file.content as List<int>;
          final outFile = await File('out/' + filename).create(recursive: true);
          await outFile.writeAsBytes(data);
        } else {
          await Directory('out/' + filename).create(recursive: true);
        }
      }
    }
  }

  void showMultiplePicker(Manifest manifest) {
    var menuList = manifest.children.map((x) => x.title).toList();
    for (var i = 0; i < menuList.length; i++) {
      print('${(i + 1).toString().padLeft(3)}) ${menuList[i]}');
    }
    print('Select feature (Enter or 0 to continue)');
    var result = stdin.readLineSync();
    var intValue = int.tryParse(result) ?? 0;
    intValue--;

    if (intValue == -1) {
      return;
    }

    var selection = manifest.children[intValue].name;
    var path = '/${manifest.name}/$selection';

    options.putIfAbsent(path, () => true);

    if (manifest.children[0].children?.length == null) {
      return;
    }

    showOption(path, manifest.children[intValue]);
    showMultiplePicker(manifest);
  }

  void showOption(String path, Manifest manifest) {
    var menuList = manifest.children.map((x) => x.title).toList();
    for (var i = 0; i < menuList.length; i++) {
      print('${(i + 1).toString().padLeft(3)}) ${menuList[i]}');
    }
    if (manifest.interface.children == 'multiple') {
      var joinString = manifest.children
          .asMap()
          .entries
          .map((entry) => entry.key + 1)
          .toList()
          .join(',');

      print(
          'Select range: 1-${manifest.children.length} or ${joinString} (Enter or 0 to exit)');
    } else {
      print('Select option (Enter or 0 to exit)');
    }
    var result = stdin.readLineSync();
    var intValue = int.tryParse(result) ?? 0;
    intValue--;
    if (intValue == -1 ||
        (manifest.children[0].children?.length == null &&
            manifest.children[0].parameters == null)) {
      return;
    }

    var optionPath = path + '/' + manifest.children[intValue].name;

    options.putIfAbsent(optionPath, () => true);

    if (manifest.children[intValue].parameters?.length > 0) {
      showParams(optionPath, manifest.children[intValue].parameters);
    }
  }

  void showParams(String path, List<Parameters> parameters) {
    for (var i = 0; i < parameters.length; i++) {
      final param = parameters[i];
      print(
          'Enter: ${param.title} (${param.placeholder}, ${param.description}');
      var result = stdin.readLineSync();
      var intValue = int.tryParse(result) ?? 0;
      if (intValue == -1) {
        return;
      }
      options.putIfAbsent(path + '/' + param.name, () => result);
    }
  }
}
