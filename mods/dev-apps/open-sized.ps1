param([string]$Url, [int]$Width, [int]$Height)
Add-Type @"
using System; using System.Collections.Generic; using System.Runtime.InteropServices; using System.Text;
public static class Win {
  public delegate bool EnumProc(IntPtr h, IntPtr l);
  [DllImport("user32.dll")] static extern bool EnumWindows(EnumProc f, IntPtr l);
  [DllImport("user32.dll")] static extern bool IsWindowVisible(IntPtr h);
  [DllImport("user32.dll")] static extern int GetClassName(IntPtr h, StringBuilder s, int n);
  [DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr h, int cmd);
  [DllImport("user32.dll")] public static extern bool MoveWindow(IntPtr h, int x, int y, int w, int ht, bool r);
  public static List<IntPtr> ChromeWindows() {
    var found = new List<IntPtr>();
    EnumWindows((h, l) => {
      var c = new StringBuilder(64); GetClassName(h, c, 64);
      if (IsWindowVisible(h) && c.ToString() == "Chrome_WidgetWin_1") found.Add(h);
      return true;
    }, IntPtr.Zero);
    return found;
  }
}
"@
$before = [Win]::ChromeWindows()
Start-Process "C:\Program Files\Google\Chrome\Application\chrome.exe" "--new-window $Url"
for ($i = 0; $i -lt 50; $i++) {
  Start-Sleep -Milliseconds 100
  $new = [Win]::ChromeWindows() | Where-Object { $before -notcontains $_ }
  if ($new) {
    $h = @($new)[0]
    Start-Sleep -Milliseconds 300
    [Win]::ShowWindow($h, 9) | Out-Null  # 9 = SW_RESTORE: a maximized window ignores MoveWindow
    [Win]::MoveWindow($h, 40, 40, $Width, $Height, $true) | Out-Null
    "resized"; exit 0
  }
}
"no new window"
exit 1
