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
  @override
  String get usageFooter => 'Example: dappstarter generate -c config.json';

  DappStarterCommand() {
    argParser.addOption('output',
        abbr: 'o',
        help: 'Output directory. If omitted current directory will be used.');
    argParser.addOption('config',
        abbr: 'c', help: 'Loads configuration from file and processes.');
    argParser.addOption('write-only',
        abbr: 'w', help: 'Writes configuration to file without processing.');
  }

  var options = <String, dynamic>{};
  String currentDirectory = basename(Directory.current.path);
  String dappName = basename(Directory.current.path);

  @override
  void run() async {
    if (argResults['config'] != null) {
      // Read file

      if ((await FileSystemEntity.type(argResults['config'])) ==
          FileSystemEntityType.notFound) {
        print('[Error] Configuration file not found.');
        return;
      }

      var data = Config.fromJson(
          jsonDecode(await File(argResults['config']).readAsString()));
      print(
          'Now initializing dapp: ${data.name}, blocks: ${data.blocks.length}');
      dappName = data.name;
      options = data.blocks;
      await postSelections(dappName, options);
      return;
    }
    http.Response response;
    try {
      response = await http.get('$hostUrl/manifest');
    } catch (e) {
      print('[Error] Unable to to fetch Dappstarter manifest');
      return;
    }

    if (response.statusCode == 200) {
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
      if (argResults['write-only'] != null) {
        await writeConfig(argResults['write-only'], dappName, options);
      } else {
        await postSelections(dappName, options);
      }
    }
  }

  Future<void> writeConfig(
      String path, String dappName, Map<String, dynamic> options) async {
    final body = jsonEncode({'name': dappName, 'blocks': options});
    final outFile = await File(path).create(recursive: true);

    await outFile.writeAsString(body);
  }

  void postSelections(String dappName, Map<String, dynamic> options) async {
    final body = jsonEncode({'name': dappName, 'blocks': options});
    http.Response response;
    try {
      response = await http.post('$hostUrl/process?github=false',
          headers: {'Content-Type': 'application/json'}, body: body);
    } catch (e) {
      print('[Error] Unable to proess configuration');
      return;
    }
    if (response.statusCode == 201) {
      print('😲 Success!');
      final processResult = ProcessResult.fromJson(jsonDecode(response.body));

      final zipResponse = await http.get(processResult.url);
      final archive = ZipDecoder().decodeBytes(zipResponse.bodyBytes);
      var outputDirectory =
          currentDirectory != 'dappstarter-cli' ? currentDirectory : 'out';
      if (argResults['output'] != null) {
        outputDirectory = argResults['output'];
      }
      // Extract this as a method
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

    if (manifest.children[intValue].parameters.isNotEmpty) {
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
