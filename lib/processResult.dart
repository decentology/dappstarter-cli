class ProcessResult {
  String url;
  String repo;

  ProcessResult.fromJson(Map<String, dynamic> json) {
    url = json['url'];
    repo = json['repo'];
  }
}
