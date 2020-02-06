import 'package:dotenv/dotenv.dart' show env, load;

class Settings {
  String _environment;
  static Settings _settings;
  String hostUrl;

  factory Settings() {
    if (_settings == null) {
      _settings = Settings._internal();
      load();
      // print(env);
      if (env.containsKey('environment')) {
        _settings._environment = env['environment'];
      } else {
        _settings._environment = 'production';
      }
      _settings.hostUrl = _settings._environment == 'production'
          ? 'https://dappstarter-api.trycrypto.com'
          : 'http://localhost:5001';
    }
    return _settings;
  }

  Settings._internal();
}
