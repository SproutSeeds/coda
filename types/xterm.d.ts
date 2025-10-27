declare module "xterm" {
  export class Terminal {
    constructor(options?: any);
    open(el: HTMLElement): void;
    write(data: string): void;
    onData(cb: (data: string) => void): void;
    loadAddon(addon: any): void;
    focus(): void;
    dispose(): void;
  }
}

declare module "@xterm/addon-fit" {
  export class FitAddon {
    fit(): void;
  }
}

declare module "xterm/css/xterm.css";

// New scoped package declarations
declare module "@xterm/xterm" {
  export class Terminal {
    constructor(options?: any);
    open(el: HTMLElement): void;
    write(data: string): void;
    onData(cb: (data: string) => void): void;
    loadAddon(addon: any): void;
    focus(): void;
    dispose(): void;
    cols?: number;
    rows?: number;
  }
}

declare module "@xterm/xterm/css/xterm.css";
