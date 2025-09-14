
export class Plugin {

  static getList = async () => {
    return ["item 1 | ID: 1", "item 2 | ID: 2", "item 3 | ID: 3"];
  }

  static getItemContext = async (key: string, value: string) => {
    return `Item context for ${key} and ${value}`;
  }

  // Enhanced method map with proper typing
  static readonly methods = {
    getList: async () => Plugin.getList(),
    getItemContext: async (key: string, value: string) => Plugin.getItemContext(key, value)
  }

  static execute<T extends keyof typeof Plugin.methods>(
        methodName: T,
        ...args: Parameters<typeof Plugin.methods[T]>
      ): ReturnType<typeof Plugin.methods[T]> {
        const method = Plugin.methods[methodName];
        return (method as Function)(...args);
  }

  static getFunction<T extends keyof typeof Plugin.methods>(
    methodName: T
  ): any {
      return Plugin.methods[methodName];
  }
}