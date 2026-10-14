import { hasOwnProperty } from './../../helpers/object';
import type { MenuItem } from './menuItem';
import type { PluginHost } from './../_base';

/** The item of a submenu with the key `<command>:<subCommandName>`. */
const findSubCommand = (subCommandName: string, subCommands: MenuItem[]): MenuItem | undefined => subCommands
  .find(cmd => cmd.key?.split(':')[1] === subCommandName);

/**
 * Command executor for ContextMenu.
 *
 * @class CommandExecutor
 * @plugin ContextMenu
 */
class CommandExecutor {
  hot: PluginHost;

  /** The commands (menu items) by key. */
  commands: Record<string, MenuItem> = {};

  /** Called after every command (with the same arguments). */
  commonCallback: ((...params: unknown[]) => void) | null = null;

  constructor(hotInstance: PluginHost) {
    this.hot = hotInstance;
  }

  /**
   * Register command.
   *
   * @param name Command name.
   * @param commandDescriptor Command descriptor object with properties like `key` (command id),
   *                          `callback` (task to execute), `name` (command name), `disabled` (command availability).
   */
  registerCommand(name: string, commandDescriptor: MenuItem): void {
    this.commands[name] = commandDescriptor;
  }

  /**
   * Set common callback which will be trigger on every executed command.
   *
   * @param callback Function which will be fired on every command execute.
   */
  setCommonCallback(callback: (...params: unknown[]) => void): void {
    this.commonCallback = callback;
  }

  /**
   * Execute command by its name (`command` or `command:subCommand`), unless it is disabled or has a submenu.
   *
   * @param commandName Command id.
   * @param params Arguments passed to command task (after the command id).
   */
  execute(commandName: string, ...params: unknown[]): void {
    const commandSplit = commandName.split(':');
    const [commandNamePrimary] = commandSplit;
    const subCommandName = commandSplit.length === 2 ? commandSplit[1] : null;
    let command: MenuItem | undefined = this.commands[commandNamePrimary];

    if (!command) {
      throw new Error(`Menu command '${commandNamePrimary}' not exists.`);
    }
    if (subCommandName && command.submenu) {
      command = findSubCommand(subCommandName, command.submenu.items);
    }
    const { disabled } = command!;

    if (disabled === true || (typeof disabled === 'function' && disabled.call(this.hot) === true)) {
      return;
    }
    if (hasOwnProperty(command!, 'submenu')) {
      return;
    }
    const callbacks = [command!.callback, this.commonCallback]
      .filter((callback): callback is (...args: unknown[]) => void => typeof callback === 'function');

    callbacks.forEach(callback => callback.apply(this.hot, [commandSplit.join(':'), ...params]));
  }
}

export default CommandExecutor;
