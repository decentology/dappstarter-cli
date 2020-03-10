import 'package:args/command_runner.dart';
import 'package:dappstarter_cli/commands/UpgradeCommand.dart';
import 'package:dappstarter_cli/commands/DappStarterCommand.dart';

String get appVersion => '##VERSION##';

void main(List<String> args) {
  var runner = CommandRunner('dappstarter', 'Full-Stack Blockchain App Mojo');
  runner
    ..argParser.addFlag('version',
        abbr: 'v', negatable: false, help: 'Print executable version number');
  runner..addCommand(DappStarterCommand());
  runner..addCommand(UpgradeCommand());

  var results = runner.argParser.parse(args);
  if (results['version']) {
    print(appVersion);
  } else {
    runner.run(args);
  }
}

