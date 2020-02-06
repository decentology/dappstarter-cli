import 'package:dotenv/dotenv.dart' show env, load;

class Settings {
  String _environment;
  static Settings _settings;
  String hostUrl;

  factory Settings() {
    if (_settings == null) {
      _settings = Settings._internal();
      load();
      if (env.containsKey('environment')) {
        _settings._environment = env['environment'];
      } else {
        _settings._environment = 'production';
      }

      if (env.containsKey('api')) {
        _settings.hostUrl = env['api'];
      } else {
        _settings.hostUrl = 'https://dappstarter-api.trycrypto.com';
      }
    }
    return _settings;
  }

  Settings._internal();
}
