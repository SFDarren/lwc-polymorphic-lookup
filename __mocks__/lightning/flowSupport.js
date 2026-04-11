export class FlowAttributeChangeEvent extends CustomEvent {
  constructor(name, value) {
    super("FlowAttributeChangeEvent");
    this.attributeName = name;
    this.attributeValue = value;
  }
}

export class FlowNavigationNextEvent extends CustomEvent {
  constructor() {
    super("FlowNavigationNextEvent");
  }
}

export class FlowNavigationBackEvent extends CustomEvent {
  constructor() {
    super("FlowNavigationBackEvent");
  }
}

export class FlowNavigationFinishEvent extends CustomEvent {
  constructor() {
    super("FlowNavigationFinishEvent");
  }
}
