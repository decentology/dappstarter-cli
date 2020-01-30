class Manifest {
  String name;
  String title;
  String description;
  String imageUrl;
  Help help;
  Interface interface;
  Metadata metadata;
  List<Parameters> parameters;
  List<Manifest> children;

  Manifest(
      {this.name,
      this.title,
      this.description,
      this.imageUrl,
      this.help,
      this.interface,
      this.metadata,
      this.parameters,
      this.children});

  Manifest.fromJson(Map<String, dynamic> json) {
    name = json['name'];
    title = json['title'];
    description = json['description'];
    imageUrl = json['imageUrl'];
    help = json['help'] != null ? new Help.fromJson(json['help']) : null;
    metadata = json['metadata'] != null
        ? new Metadata.fromJson(json['metadata'])
        : null;

    interface = json['interface'] != null
        ? new Interface.fromJson(json['interface'])
        : null;
    if (json['children'] != null) {
      children = new List<Manifest>();
      json['children'].forEach((v) {
        children.add(new Manifest.fromJson(v));
      });
    }
    if (json['parameters'] != null) {
      parameters = new List<Parameters>();
      json['parameters'].forEach((v) {
        parameters.add(new Parameters.fromJson(v));
      });
    }
  }

  Map<String, dynamic> toJson() {
    final Map<String, dynamic> data = new Map<String, dynamic>();
    data['name'] = this.name;
    data['title'] = this.title;
    data['description'] = this.description;
    data['imageUrl'] = this.imageUrl;
    if (this.help != null) {
      data['help'] = this.help.toJson();
    }
    if (this.interface != null) {
      data['interface'] = this.interface.toJson();
    }
    if (this.children != null) {
      data['children'] = this.children.map((v) => v.toJson()).toList();
    }
    if (this.parameters != null) {
      data['parameters'] = this.parameters.map((v) => v.toJson()).toList();
    }
    if (this.metadata != null) {
      data['metadata'] = this.metadata.toJson();
    }
    return data;
  }
}

class Help {
  String title;
  String url;

  Help({this.title, this.url});

  Help.fromJson(Map<String, dynamic> json) {
    title = json['title'];
    url = json['url'];
  }

  Map<String, dynamic> toJson() {
    final Map<String, dynamic> data = new Map<String, dynamic>();
    data['title'] = this.title;
    data['url'] = this.url;
    return data;
  }
}

class Interface {
  bool hidden;
  bool enabled;
  String children;

  Interface({this.hidden, this.enabled, this.children});

  Interface.fromJson(Map<String, dynamic> json) {
    hidden = json['hidden'];
    enabled = json['enabled'];
    children = json['children'];
  }

  Map<String, dynamic> toJson() {
    final Map<String, dynamic> data = new Map<String, dynamic>();
    data['hidden'] = this.hidden;
    data['enabled'] = this.enabled;
    data['children'] = this.children;
    return data;
  }
}

// class Children {
//   String name;
//   String title;
//   String description;
//   String imageUrl;
//   Help help;
//   Metadata metadata;
//   Interface interface;

//   Children(
//       {this.name,
//       this.title,
//       this.description,
//       this.imageUrl,
//       this.help,
//       this.metadata,
//       this.interface});

//   Children.fromJson(Map<String, dynamic> json) {
//     name = json['name'];
//     title = json['title'];
//     description = json['description'];
//     imageUrl = json['imageUrl'];
//     help = json['help'] != null ? new Help.fromJson(json['help']) : null;
//     metadata = json['metadata'] != null
//         ? new Metadata.fromJson(json['metadata'])
//         : null;
//     interface = json['interface'] != null
//         ? new Interface.fromJson(json['interface'])
//         : null;
//   }

//   Map<String, dynamic> toJson() {
//     final Map<String, dynamic> data = new Map<String, dynamic>();
//     data['name'] = this.name;
//     data['title'] = this.title;
//     data['description'] = this.description;
//     data['imageUrl'] = this.imageUrl;
//     if (this.help != null) {
//       data['help'] = this.help.toJson();
//     }
//     if (this.metadata != null) {
//       data['metadata'] = this.metadata.toJson();
//     }
//     if (this.interface != null) {
//       data['interface'] = this.interface.toJson();
//     }
//     return data;
//   }
// }

class Metadata {
  String developerExperience;
  String different;

  Metadata({this.developerExperience, this.different});

  Metadata.fromJson(Map<String, dynamic> json) {
    developerExperience = json['developer_experience'];
    different = json['different'];
  }

  Map<String, dynamic> toJson() {
    final Map<String, dynamic> data = new Map<String, dynamic>();
    data['developer_experience'] = this.developerExperience;
    data['different'] = this.different;
    return data;
  }
}

class Parameters {
  String name;
  String type;
  String title;
  String placeholder;
  String defaultValue;
  int minLength;
  int maxLength;
  String description;

  Parameters(
      {this.name,
      this.type,
      this.title,
      this.placeholder,
      this.defaultValue,
      this.minLength,
      this.maxLength,
      this.description});

  Parameters.fromJson(Map<String, dynamic> json) {
    name = json['name'];
    type = json['type'];
    title = json['title'];
    placeholder = json['placeholder'];
    defaultValue = json['defaultValue'];
    minLength = json['minLength'];
    maxLength = json['maxLength'];
    description = json['description'];
  }

  Map<String, dynamic> toJson() {
    final Map<String, dynamic> data = new Map<String, dynamic>();
    data['name'] = this.name;
    data['type'] = this.type;
    data['title'] = this.title;
    data['placeholder'] = this.placeholder;
    data['defaultValue'] = this.defaultValue;
    data['minLength'] = this.minLength;
    data['maxLength'] = this.maxLength;
    data['description'] = this.description;
    return data;
  }
}
