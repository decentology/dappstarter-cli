import 'dart:io';
import 'package:args/command_runner.dart';
import 'package:console/console.dart';
import 'package:http/http.dart';
import 'package:path/path.dart';

class UpgradeCommand extends Command {
  @override
  String get description => 'Upgrade dappstarter';

  @override
  String get name => 'upgrade';

  @override
  void run() async {
    var env = Platform.environment;
    Response response;
    try {
      response = await get(
          'https://github.com/trycrypto/dappstarter-cli/releases/latest/download/dappstarter.exe');
    } catch (e) {
      TextPen()
        ..red()
        ..text('${Icon.HEAVY_BALLOT_X} Unable to download Dappstarter manifest.')
            .print();
      return null;
    }
    if (response.statusCode == 200) {
      if (Platform.isWindows && env.containsKey('USERPROFILE')) {
        var outputPath = join(env['USERPROFILE'], 'dappstarter.exe');
        if (await FileSystemEntity.type(outputPath) ==
            FileSystemEntityType.file) {
          var newName = join(env['USERPROFILE'], 'dappstarter_new.exe');
          var bat = join(env['USERPROFILE'], 'dappstarter_rename.bat');
          await File(newName).writeAsBytes(response.bodyBytes);
          await File(bat).writeAsString('''
            rem timeout 1 > NUL
            rename dappstarter.exe dappstarter_rm.exe
            rename dappstarter_new.exe dappstarter.exe
            del dappstarter_rm.exe
            del dappstarter_new.exe
            del dappstarter_rename.bat
        ''');
          await Process.start('start ', ['cmd', '/c', bat], runInShell: true);
          TextPen()
            ..green()
            ..text('${Icon.HEAVY_CHECKMARK} Successfully updated to latest version.')
                .print();
          return null;
        }
      } else if (Platform.isLinux || Platform.isMacOS) {
        print('[PATH] ${Platform.script.toString()}');
      }
    }
    TextPen()
      ..yellow()
      ..text('${Icon.HEAVY_BALLOT_X} Dappstarter was not upgraded.').print();
  }
}
