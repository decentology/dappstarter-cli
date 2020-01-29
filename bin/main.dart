import 'dart:convert';
import 'package:args/command_runner.dart';
import 'package:cli_menu/cli_menu.dart';
import 'package:dappstarter_cli/manifest.dart';
import 'package:demoji/demoji.dart';
import 'package:http/http.dart' as http;

void main(List<String> args) {
  var runner = CommandRunner('dappstarter', 'Full-Stack Blockchain App Mojo');
  runner..addCommand(DappStarterCommand());
  runner.run(args);
}

class DappStarterCommand extends Command {
  @override
  String get description => 'Generate dappstarter';
  @override
  String get name => 'generate';

  DappStarterCommand() {
    argParser.addFlag('all', abbr: 'a');
  }

  List<String> options = <String>[];

  @override
  void run() async {
    final response =
        await http.get('https://dappstarter-api.trycrypto.com/manifest');
    var manifest = (jsonDecode(response.body))
        .map((model) => Manifest.fromJson(model))
        .toList();

    manifest.forEach((m) {
      showPicker(m);
    });
    print('${Demoji.heart}  Your seletions ${options.toString()}');
  }

  void showPicker(Manifest manifest) {
    print('Select your ${manifest.title}');
    final menu = Menu(manifest.children.map((f) => f.title));
    final result = menu.choose();
    options.add(result.toString());
  }

  void postSelections(List<String> options) async {
    final response = await http.post('https://dappstarter-api.trycrypto.com/process?github=false');
  }
}
