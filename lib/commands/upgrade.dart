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

    if (Platform.isWindows && env.containsKey('USERPROFILE')) {
      var response = await getFile(true);
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
        _successMessage();
        return null;
      }
    } else if (Platform.isLinux || Platform.isMacOS) {
      var response = await getFile();
      var outputPath = Platform.executable.toString();
      await File(outputPath).delete();
      await File(outputPath).writeAsBytes(response.bodyBytes);
      await Process.run('chmod', ['+x', outputPath]);
      _successMessage();
      return null;
    }

    TextPen()
      ..yellow()
      ..text('${Icon.HEAVY_BALLOT_X} Dappstarter was not upgraded.').print();
  }

  void _successMessage() {
    TextPen()
      ..green()
      ..text('${Icon.HEAVY_CHECKMARK} Successfully updated to latest version.')
          .print();
  }

  Future<Response> getFile([bool isWindows = false]) async {
    try {
      var response = await get(
          'https://github.com/trycrypto/dappstarter-cli/releases/latest/download/dappstarter' +
              (isWindows ? '.exe' : ''));
      if (response.statusCode == 200) {
        return response;
      }
      TextPen()
        ..red()
        ..text('${Icon.HEAVY_BALLOT_X} Error while attempting to download DappStarter executable.')
            .print();
    } catch (e) {
      TextPen()
        ..red()
        ..text('${Icon.HEAVY_BALLOT_X} Unable to download Dappstarter executable.')
            .print();
    }
    return null;
  }
}
