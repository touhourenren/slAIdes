import { Menu } from '@tauri-apps/api/menu';
import { isTauri } from '@tauri-apps/api/core';

export interface NativeMenuActions {
  newDocument(): void;
  openDocument(): void;
  saveDocument(): void;
  saveDocumentAs(): void;
  closeDocument(): void;
  quit(): void;
  undo(): void;
  redo(): void;
}

let installedMenu: Menu | undefined;

export async function installNativeMenu(
  actions: NativeMenuActions
): Promise<Menu | undefined> {
  if (!isTauri()) return undefined;
  installedMenu?.close();
  const menu = await Menu.new({
    items: [
      {
        text: 'SlAIdes',
        items: [
          { id: 'about', text: 'About SlAIdes', enabled: false },
          { item: 'Separator' },
          {
            id: 'quit',
            text: 'Quit SlAIdes',
            accelerator: 'CmdOrCtrl+Q',
            action: actions.quit
          }
        ]
      },
      {
        text: 'File',
        items: [
          {
            id: 'new-document',
            text: 'New Presentation',
            accelerator: 'CmdOrCtrl+N',
            action: actions.newDocument
          },
          {
            id: 'open-document',
            text: 'Open…',
            accelerator: 'CmdOrCtrl+O',
            action: actions.openDocument
          },
          { item: 'Separator' },
          {
            id: 'save-document',
            text: 'Save',
            accelerator: 'CmdOrCtrl+S',
            action: actions.saveDocument
          },
          {
            id: 'save-document-as',
            text: 'Save As…',
            accelerator: 'CmdOrCtrl+Shift+S',
            action: actions.saveDocumentAs
          },
          { item: 'Separator' },
          {
            id: 'close-document',
            text: 'Close Presentation',
            accelerator: 'CmdOrCtrl+W',
            action: actions.closeDocument
          }
        ]
      },
      {
        text: 'Edit',
        items: [
          {
            id: 'undo-document',
            text: 'Undo',
            accelerator: 'CmdOrCtrl+Z',
            action: actions.undo
          },
          {
            id: 'redo-document',
            text: 'Redo',
            accelerator: 'CmdOrCtrl+Shift+Z',
            action: actions.redo
          },
          { item: 'Separator' },
          { item: 'Cut' },
          { item: 'Copy' },
          { item: 'Paste' },
          { item: 'SelectAll' }
        ]
      }
    ]
  });
  await menu.setAsAppMenu();
  installedMenu = menu;
  return menu;
}
