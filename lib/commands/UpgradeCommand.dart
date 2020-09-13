import 'dart:convert';
import 'dart:io';
import 'dart:typed_data';
import 'package:archive/archive.dart';
import 'package:args/command_runner.dart';
import 'package:console/console.dart';
import 'package:dappstarter_cli/models/githubRelease.dart';
import 'package:http/http.dart';
import 'package:path/path.dart';

class UpgradeCommand extends Command {
  @override
  String get description => 'Upgrade dappstarter';

  @override
  String get name => 'upgrade';

  UpgradeCommand() {
    argParser.addFlag('check-version',
        abbr: 'v', help: 'Check the current available version');
  }

  @override
  void run() async {
    if (argResults['check-version']) {
      await getVersion();
      return;
    }

    if (Platform.isWindows) {
      var response = await getFile();
      var outputPath = Platform.executable
          .toString()
          .substring(0, Platform.executable.toString().lastIndexOf('\\'));

      var newName = join(outputPath, 'dappstarter_new.exe');
      var bat = join(outputPath, 'dappstarter_rename.bat');
      await File(newName).writeAsBytes(response.bodyBytes);
      await File(bat).writeAsString('''
            timeout 1 > NUL
            rename dappstarter.exe dappstarter_rm.exe
            rename dappstarter_new.exe dappstarter.exe
            del dappstarter_rm.exe
            del dappstarter_new.exe
            del dappstarter_rename.bat
        ''');
      await Process.start('start ', ['cmd', '/c', bat], runInShell: true);
      _successMessage();
      return null;
    } else if (Platform.isLinux || Platform.isMacOS) {
      var response = await getFile();
      var outputPath = Platform.executable.toString();
      await File(outputPath).delete();
      await File(outputPath)
          .writeAsBytes(await getFileFromZip(response.bodyBytes));
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

  Future<List<int>> getFileFromZip(Uint8List bytes) async {
    final archive = ZipDecoder().decodeBytes(bytes);
    var file = archive.first;
    if (file.isFile) {
      return file.content;
    }
    return null;
  }

  Future<Response> getFile() async {
    try {
      var response = await get(
          'https://api.github.com/repos/trycrypto/dappstarter-cli/releases/latest');
      if (response.statusCode == 200) {
        var releases = GithubRelease.fromJson(jsonDecode(response.body));

        var downloadLink = '';
        if (Platform.isLinux) {
          downloadLink = releases.assets
              .firstWhere((x) => x.name.contains('linux'))
              .browserDownloadUrl;
        } else if (Platform.isMacOS) {
          downloadLink = releases.assets
              .firstWhere((x) => x.name.contains('osx'))
              .browserDownloadUrl;
        } else if (Platform.isWindows) {
          downloadLink = releases.assets
              .firstWhere((x) => x.name.contains('dappstarter.exe'))
              .browserDownloadUrl;
        } else {
          TextPen()
            ..red()
            ..text('${Icon.HEAVY_BALLOT_X} Platform is not supported.');
          exit(1);
        }

        response = await get(downloadLink);
        if (response.statusCode == 200) {
          return response;
        } else {
          TextPen()
            ..red()
            ..text('${Icon.HEAVY_BALLOT_X} Error while attempting to download DappStarter executable.')
                .print();
        }
      } else {
        TextPen()
          ..red()
          ..text(
              '${Icon.HEAVY_BALLOT_X} Unable to download releases from GitHub');
        exit(1);
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

  Future<VersionDTO> getVersion() async {
    var response = await get(
        'https://api.github.com/repos/trycrypto/dappstarter-cli/releases/latest');
    var data = VersionDTO.fromJson(jsonDecode(response.body));
    print('Latest version ' + data.tag_name);
    return data;
  }
}

class VersionDTO {
  String tag_name;
  VersionDTO.fromJson(Map<String, dynamic> json) {
    tag_name = json['tag_name'];
  }
}
