import { execFile } from 'node:child_process';

async function runPowerShellDialogScript(psScript: string): Promise<string | null> {
  if (process.platform !== 'win32') return null;
  return new Promise((resolve) => {
    try {
      const buf = Buffer.from(psScript, 'utf-16le');
      const base64 = buf.toString('base64');
      execFile('powershell', ['-Sta', '-NoProfile', '-EncodedCommand', base64], { encoding: 'utf-8' }, (err: any, stdout: string) => {
        if (err) {
          console.error('Failed to open native Windows dialog:', err);
          resolve(null);
        } else {
          const res = (stdout || '').trim();
          resolve(res.length > 0 ? res : null);
        }
      });
    } catch (err) {
      console.error('Failed to open native Windows dialog:', err);
      resolve(null);
    }
  });
}

export async function selectWorkspaceNative(): Promise<string | null> {
  // Modern Windows Vista/10/11 IFileOpenDialog with FOS_PICKFOLDERS (Native File Explorer Layout)
  const psScript = `
    $csharp = @"
using System;
using System.Runtime.InteropServices;

public class NativeFolderPicker {
    [ComImport]
    [Guid("d57c7288-d4ad-4768-be02-9d969532d960")]
    [InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
    private interface IFileOpenDialog {
        [PreserveSig] int Show(IntPtr parent);
        void SetFileTypes();
        void SetFileTypeIndex();
        void GetFileTypeIndex();
        void Advise();
        void Unadvise();
        void SetOptions(uint fos);
        void GetOptions(out uint fos);
        void SetDefaultFolder(IntPtr psi);
        void SetFolder(IntPtr psi);
        void GetFolder(out IntPtr ppsi);
        void GetCurrentSelection(out IntPtr ppsi);
        void SetFileName([MarshalAs(UnmanagedType.LPWStr)] string pszName);
        void GetFileName([MarshalAs(UnmanagedType.LPWStr)] out string pszName);
        void SetTitle([MarshalAs(UnmanagedType.LPWStr)] string pszTitle);
        void SetOkButtonLabel([MarshalAs(UnmanagedType.LPWStr)] string pszText);
        void SetFileNameLabel([MarshalAs(UnmanagedType.LPWStr)] string pszLabel);
        void GetResult(out IntPtr ppsi);
        void AddPlace();
        void SetDefaultExtension();
        void Close();
        void SetClientGuid();
        void ClearClientData();
        void SetFilter();
        void GetResults();
        void GetSelectedItems();
    }

    [ComImport]
    [Guid("DC1C5A9C-E88A-4dde-A5A1-60F82A20AEF7")]
    class FileOpenDialogClass {}

    [ComImport]
    [Guid("43826D1E-E718-42EE-BC55-A1E261C37BFE")]
    [InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
    private interface IShellItem {
        void BindToHandler();
        void GetParent();
        void GetDisplayName(uint sigdnName, [MarshalAs(UnmanagedType.LPWStr)] out string ppszName);
        void GetAttributes();
        void Compare();
    }

    public static string ShowDialog(string title) {
        var dialog = (IFileOpenDialog)new FileOpenDialogClass();
        dialog.SetOptions(0x00000020 | 0x00000008 | 0x00000040); // FOS_PICKFOLDERS | FOS_FORCEFILESYSTEM | FOS_PATHMUSTEXIST
        dialog.SetTitle(title ?? "Выберите папку Workspace");
        dialog.SetOkButtonLabel("Выбрать папку");

        int hr = dialog.Show(IntPtr.Zero);
        if (hr == 0) {
            IntPtr ppsi;
            dialog.GetResult(out ppsi);
            if (ppsi != IntPtr.Zero) {
                var item = (IShellItem)Marshal.GetObjectForIUnknown(ppsi);
                string path;
                item.GetDisplayName(0x80058000, out path); // SIGDN_FILESYSPATH
                Marshal.Release(ppsi);
                return path;
            }
        }
        return null;
    }
}
"@
    try {
        Add-Type -TypeDefinition $csharp -ErrorAction Stop
        $res = [NativeFolderPicker]::ShowDialog("Выберите папку Workspace для 0xAgent")
        if ($res) {
            Write-Output $res
            exit 0
        }
    } catch {
        # Fallback to OpenFileDialog folder trick if COM fails
        Add-Type -AssemblyName System.Windows.Forms
        $dialog = New-Object System.Windows.Forms.OpenFileDialog
        $dialog.Title = "Выберите папку Workspace (Проекта)"
        $dialog.ValidateNames = $false
        $dialog.CheckFileExists = $false
        $dialog.CheckPathExists = $true
        $dialog.FileName = "Выбор текущей папки"
        if ($dialog.ShowDialog() -eq [System.Windows.Forms.DialogResult]::OK) {
            $folder = [System.IO.Path]::GetDirectoryName($dialog.FileName)
            Write-Output $folder
        }
    }
  `;
  return runPowerShellDialogScript(psScript);
}

export async function selectFileNative(filter?: string): Promise<string | null> {
  const filterStr = filter || "All Files (*.*)|*.*|Executables (*.exe)|*.exe|GGUF Models (*.gguf)|*.gguf";
  const psScript = `
    Add-Type -AssemblyName System.Windows.Forms
    $dialog = New-Object System.Windows.Forms.OpenFileDialog
    $dialog.Title = "Выбор файла"
    $dialog.Filter = "${filterStr}"
    $result = $dialog.ShowDialog()
    if ($result -eq [System.Windows.Forms.DialogResult]::OK) {
        Write-Output $dialog.FileName
    }
  `;
  return runPowerShellDialogScript(psScript);
}
