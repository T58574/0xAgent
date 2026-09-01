using System;
using System.Diagnostics;
using System.Drawing;
using System.Drawing.Drawing2D;
using System.IO;
using System.Net;
using System.Reflection;
using System.Runtime.InteropServices;
using System.Text;
using System.Threading;
using System.Windows.Forms;

namespace OxAgent.Launcher
{
    public class TrayApplicationContext : ApplicationContext
    {
        private NotifyIcon _notifyIcon;
        private ContextMenuStrip _contextMenu;
        private ToolStripMenuItem _openMenuItem;
        private ToolStripMenuItem _statusMenuItem;
        private ToolStripMenuItem _veronicaMenuItem;
        private ToolStripMenuItem _purgeVramMenuItem;
        private ToolStripMenuItem _updateMenuItem;
        private ToolStripMenuItem _logsMenuItem;
        private ToolStripMenuItem _restartMenuItem;

        private ToolStripMenuItem _exitMenuItem;
        private Process _devProcess;
        private System.Windows.Forms.Timer _healthTimer;
        private string _projectDir;
        private string _logFilePath;
        private StreamWriter _logWriter;
        private bool _isShuttingDown = false;
        private bool _hasAutoOpenedBrowser = false;

        public TrayApplicationContext()
        {
            _projectDir = Path.GetDirectoryName(Assembly.GetExecutingAssembly().Location);
            if (string.IsNullOrEmpty(_projectDir))
            {
                _projectDir = AppDomain.CurrentDomain.BaseDirectory;
            }

            string logsDir = Path.Combine(_projectDir, "logs");
            if (!Directory.Exists(logsDir))
            {
                Directory.CreateDirectory(logsDir);
            }
            _logFilePath = Path.Combine(logsDir, "0xAgent_launcher.log");

            try
            {
                _logWriter = new StreamWriter(new FileStream(_logFilePath, FileMode.Create, FileAccess.Write, FileShare.ReadWrite), Encoding.UTF8)
                {
                    AutoFlush = true
                };
            }
            catch
            {
                // Fallback if log writer cannot open
            }

            Log("[0xAgent Launcher] Initializing Tray Supervisor...");

            try
            {
                ServicePointManager.ServerCertificateValidationCallback = delegate { return true; };
                ServicePointManager.SecurityProtocol = SecurityProtocolType.Tls12 | SecurityProtocolType.Tls11 | SecurityProtocolType.Tls;
            }
            catch {}

            InitializeTrayIcon();
            StartServices();

            _healthTimer = new System.Windows.Forms.Timer
            {
                Interval = 3000
            };
            _healthTimer.Tick += HealthTimer_Tick;
            _healthTimer.Start();
        }

        private void Log(string message)
        {
            try
            {
                string line = string.Format("[{0:yyyy-MM-dd HH:mm:ss}] {1}", DateTime.Now, message);
                if (_logWriter != null)
                {
                    _logWriter.WriteLine(line);
                }
            }
            catch {}
        }

        private Icon CreateCyberAppIcon()
        {
            try
            {
                string iconPath = Path.Combine(_projectDir, "0xAgent-icon.jpg");
                if (!File.Exists(iconPath))
                {
                    iconPath = Path.Combine(_projectDir, "public", "0xAgent-icon.jpg");
                }

                if (File.Exists(iconPath))
                {
                    using (Image srcImg = Image.FromFile(iconPath))
                    using (Bitmap bmp = new Bitmap(32, 32))
                    using (Graphics g = Graphics.FromImage(bmp))
                    {
                        g.SmoothingMode = SmoothingMode.AntiAlias;
                        g.InterpolationMode = InterpolationMode.HighQualityBicubic;
                        g.Clear(Color.Transparent);

                        using (GraphicsPath path = new GraphicsPath())
                        {
                            int radius = 8;
                            Rectangle rect = new Rectangle(0, 0, 31, 31);
                            path.AddArc(rect.X, rect.Y, radius, radius, 180, 90);
                            path.AddArc(rect.Right - radius, rect.Y, radius, radius, 270, 90);
                            path.AddArc(rect.Right - radius, rect.Bottom - radius, radius, radius, 0, 90);
                            path.AddArc(rect.X, rect.Bottom - radius, radius, radius, 90, 90);
                            path.CloseFigure();

                            g.SetClip(path);
                            g.DrawImage(srcImg, rect);
                            g.ResetClip();

                            using (Pen borderPen = new Pen(Color.FromArgb(100, 255, 255, 255), 1.5f))
                            {
                                g.DrawPath(borderPen, path);
                            }
                        }

                        IntPtr hIcon = bmp.GetHicon();
                        return Icon.FromHandle(hIcon);
                    }
                }

                // Fallback procedural icon
                using (Bitmap bmp = new Bitmap(32, 32))
                using (Graphics g = Graphics.FromImage(bmp))
                {
                    g.SmoothingMode = SmoothingMode.AntiAlias;
                    g.Clear(Color.Transparent);

                    // Outer glowing rounded box
                    using (GraphicsPath path = new GraphicsPath())
                    {
                        int radius = 8;
                        Rectangle rect = new Rectangle(1, 1, 29, 29);
                        path.AddArc(rect.X, rect.Y, radius, radius, 180, 90);
                        path.AddArc(rect.Right - radius, rect.Y, radius, radius, 270, 90);
                        path.AddArc(rect.Right - radius, rect.Bottom - radius, radius, radius, 0, 90);
                        path.AddArc(rect.X, rect.Bottom - radius, radius, radius, 90, 90);
                        path.CloseFigure();

                        using (SolidBrush bgBrush = new SolidBrush(Color.FromArgb(240, 9, 13, 22)))
                        {
                            g.FillPath(bgBrush, path);
                        }

                        using (Pen borderPen = new Pen(Color.FromArgb(255, 16, 185, 129), 2f))
                        {
                            g.DrawPath(borderPen, path);
                        }
                    }

                    // Cyber symbol "0x"
                    using (Font font = new Font("Consolas", 11, FontStyle.Bold))
                    using (SolidBrush textBrush = new SolidBrush(Color.FromArgb(255, 56, 189, 248)))
                    {
                        StringFormat sf = new StringFormat
                        {
                            Alignment = StringAlignment.Center,
                            LineAlignment = StringAlignment.Center
                        };
                        g.DrawString("0x", font, textBrush, new RectangleF(0, 0, 32, 32), sf);
                    }

                    IntPtr hIcon = bmp.GetHicon();
                    return Icon.FromHandle(hIcon);
                }
            }
            catch
            {
                return SystemIcons.Application;
            }
        }

        public static string GetPrimaryLanAddress()
        {
            try
            {
                foreach (var netIface in System.Net.NetworkInformation.NetworkInterface.GetAllNetworkInterfaces())
                {
                    if (netIface.OperationalStatus == System.Net.NetworkInformation.OperationalStatus.Up &&
                        netIface.NetworkInterfaceType != System.Net.NetworkInformation.NetworkInterfaceType.Loopback)
                    {
                        var ipProps = netIface.GetIPProperties();
                        foreach (var addr in ipProps.UnicastAddresses)
                        {
                            if (addr.Address.AddressFamily == System.Net.Sockets.AddressFamily.InterNetwork)
                            {
                                string ipStr = addr.Address.ToString();
                                if (ipStr.StartsWith("192.168.") || ipStr.StartsWith("10.") || ipStr.StartsWith("172."))
                                {
                                    return ipStr;
                                }
                            }
                        }
                    }
                }
            }
            catch {}

            return "192.168.4.24";
        }

        private string GetAppLanguage()
        {
            try
            {
                string userHome = Environment.GetFolderPath(Environment.SpecialFolder.UserProfile);
                string configPath = Path.Combine(userHome, ".0xagent", "config.json");
                if (File.Exists(configPath))
                {
                    string json = File.ReadAllText(configPath);
                    if (json.Contains("\"language\": \"en\"") || json.Contains("\"language\":\"en\""))
                    {
                        return "en";
                    }
                }
            }
            catch {}
            return "ru";
        }

        private void UpdateMenuLocalization()
        {
            try
            {
                bool isEn = GetAppLanguage() == "en";
                string lanIp = GetPrimaryLanAddress();

                if (_openMenuItem != null)
                {
                    _openMenuItem.Text = isEn
                        ? string.Format("🌐  Open 0xAgent UI (https://{0}:5173)", lanIp)
                        : string.Format("🌐  Открыть 0xAgent UI (https://{0}:5173)", lanIp);
                }
                if (_purgeVramMenuItem != null)
                {
                    _purgeVramMenuItem.Text = isEn
                        ? "⚡  Purge GPU VRAM (llama-server)"
                        : "⚡  Очистить GPU VRAM (llama-server)";
                }
                if (_updateMenuItem != null)
                {
                    _updateMenuItem.Text = isEn
                        ? "🔄  Check for Updates..."
                        : "🔄  Проверить обновления...";
                }
                if (_logsMenuItem != null)

                {
                    _logsMenuItem.Text = isEn
                        ? "📜  Show Logs"
                        : "📜  Показать логи";
                }
                if (_restartMenuItem != null)
                {
                    _restartMenuItem.Text = isEn
                        ? "🔄  Restart Platform"
                        : "🔄  Перезапустить платформу";
                }
                if (_exitMenuItem != null)
                {
                    _exitMenuItem.Text = isEn
                        ? "🛑  Exit (Stop all processes)"
                        : "🛑  Выход (Остановить все процессы)";
                }
            }
            catch {}
        }

        private void PurgeGpuVram()
        {
            bool isEn = GetAppLanguage() == "en";
            Log("[0xAgent Launcher] Purging GPU VRAM and stopping llama-server processes...");

            ThreadPool.QueueUserWorkItem(_ =>
            {
                try
                {
                    // 1. Call REST API if server is up
                    try
                    {
                        HttpWebRequest req = (HttpWebRequest)WebRequest.Create("https://127.0.0.1:3001/api/purge-vram");
                        req.Method = "POST";
                        req.Timeout = 1500;
                        req.ContentLength = 0;
                        using (var res = req.GetResponse()) {}
                    }
                    catch
                    {
                        try
                        {
                            HttpWebRequest reqHttp = (HttpWebRequest)WebRequest.Create("http://127.0.0.1:3001/api/purge-vram");
                            reqHttp.Method = "POST";
                            reqHttp.Timeout = 1000;
                            reqHttp.ContentLength = 0;
                            using (var resHttp = reqHttp.GetResponse()) {}
                        }
                        catch {}
                    }

                    // 2. Direct process kill on Windows to ensure 0 orphaned handles
                    string[] targets = new string[] { "llama-server.exe", "llama.exe", "llama-bench.exe" };
                    foreach (string t in targets)
                    {
                        try
                        {
                            ProcessStartInfo psi = new ProcessStartInfo
                            {
                                FileName = "taskkill.exe",
                                Arguments = string.Format("/F /T /IM {0}", t),
                                CreateNoWindow = true,
                                UseShellExecute = false,
                                WindowStyle = ProcessWindowStyle.Hidden
                            };
                            using (Process p = Process.Start(psi))
                            {
                                if (p != null) p.WaitForExit(1500);
                            }
                        }
                        catch {}
                    }

                    Log("[0xAgent Launcher] GPU VRAM purged successfully.");

                    if (_notifyIcon != null)
                    {
                        string title = isEn ? "0xAgent GPU Memory" : "0xAgent Память GPU";
                        string msg = isEn
                            ? "GPU VRAM purged: All local llama-server processes terminated and VRAM freed."
                            : "VRAM очищена: Процессы llama-server остановлены, видеопамять освобождена.";
                        _notifyIcon.ShowBalloonTip(2500, title, msg, ToolTipIcon.Info);
                    }
                }
                catch (Exception ex)
                {
                    Log("[0xAgent Launcher] Error purging VRAM: " + ex.Message);
                }
            });
        }

        private void InitializeTrayIcon()
        {
            _contextMenu = new ContextMenuStrip
            {
                ShowImageMargin = false,
                RenderMode = ToolStripRenderMode.System
            };
            _contextMenu.Opening += (s, e) => UpdateMenuLocalization();

            // 1. Open UI
            string lanIp = GetPrimaryLanAddress();
            bool isEn = GetAppLanguage() == "en";

            _openMenuItem = new ToolStripMenuItem(isEn ? string.Format("🌐  Open 0xAgent UI (https://{0}:5173)", lanIp) : string.Format("🌐  Открыть 0xAgent UI (https://{0}:5173)", lanIp), null, (s, e) => OpenWebUI());
            _openMenuItem.Font = new Font(_contextMenu.Font, FontStyle.Bold);
            _contextMenu.Items.Add(_openMenuItem);

            _contextMenu.Items.Add(new ToolStripSeparator());

            // 2. Status item
            _statusMenuItem = new ToolStripMenuItem(isEn ? "📊  Status: Initializing..." : "📊  Статус: Инициализация...")
            {
                Enabled = false
            };
            _contextMenu.Items.Add(_statusMenuItem);

            // 2.1 Veronica Status item
            _veronicaMenuItem = new ToolStripMenuItem(isEn ? "🤖  Veronica: Assistant Active" : "🤖  Вероника: Ассистент Активен")
            {
                Enabled = false
            };
            _contextMenu.Items.Add(_veronicaMenuItem);

            // 3. Purge GPU VRAM
            _purgeVramMenuItem = new ToolStripMenuItem(isEn ? "⚡  Purge GPU VRAM (llama-server)" : "⚡  Очистить GPU VRAM (llama-server)", null, (s, e) => PurgeGpuVram());
            _contextMenu.Items.Add(_purgeVramMenuItem);

            // 3.1 Check for Updates
            _updateMenuItem = new ToolStripMenuItem(isEn ? "🔄  Check for Updates..." : "🔄  Проверить обновления...", null, (s, e) => CheckForUpdates());
            _contextMenu.Items.Add(_updateMenuItem);

            // 4. Show Logs
            _logsMenuItem = new ToolStripMenuItem(isEn ? "📜  Show Logs" : "📜  Показать логи", null, (s, e) => OpenLogs());
            _contextMenu.Items.Add(_logsMenuItem);


            _contextMenu.Items.Add(new ToolStripSeparator());

            // 5. Restart
            _restartMenuItem = new ToolStripMenuItem(isEn ? "🔄  Restart Platform" : "🔄  Перезапустить платформу", null, (s, e) => RestartServices());
            _contextMenu.Items.Add(_restartMenuItem);

            // 6. Exit
            _exitMenuItem = new ToolStripMenuItem(isEn ? "🛑  Exit (Stop all processes)" : "🛑  Выход (Остановить все процессы)", null, (s, e) => ExitApplication());
            _contextMenu.Items.Add(_exitMenuItem);

            _notifyIcon = new NotifyIcon
            {
                Icon = CreateCyberAppIcon(),
                ContextMenuStrip = _contextMenu,
                Text = "0xAgent AI Platform",
                Visible = true
            };

            _notifyIcon.DoubleClick += (s, e) => OpenWebUI();

            string balloonTitle = "0xAgent AI Platform";
            string balloonMsg = isEn
                ? "Platform running in background and available from tray."
                : "Платформа запущена в фоновом режиме и доступна в трее.";
            _notifyIcon.ShowBalloonTip(3000, balloonTitle, balloonMsg, ToolTipIcon.Info);
        }

        private void StartServices()
        {
            KillStalePorts();

            Log("[0xAgent Launcher] Starting 'npm run dev' in background...");

            try
            {
                ProcessStartInfo psi = new ProcessStartInfo
                {
                    FileName = "cmd.exe",
                    Arguments = "/c npm run dev",
                    WorkingDirectory = _projectDir,
                    CreateNoWindow = true,
                    UseShellExecute = false,
                    WindowStyle = ProcessWindowStyle.Hidden,
                    RedirectStandardOutput = true,
                    RedirectStandardError = true,
                    StandardOutputEncoding = Encoding.UTF8,
                    StandardErrorEncoding = Encoding.UTF8
                };

                _devProcess = new Process { StartInfo = psi };

                _devProcess.OutputDataReceived += (s, e) =>
                {
                    if (!string.IsNullOrEmpty(e.Data))
                    {
                        Log("[DEV] " + e.Data);
                        if (!_hasAutoOpenedBrowser && (e.Data.Contains("5173") || e.Data.Contains("Local:") || e.Data.Contains("Network:")))
                        {
                            _hasAutoOpenedBrowser = true;
                            ThreadPool.QueueUserWorkItem(_ =>
                            {
                                Thread.Sleep(800);
                                OpenWebUI();
                            });
                        }
                    }
                };

                _devProcess.ErrorDataReceived += (s, e) =>
                {
                    if (!string.IsNullOrEmpty(e.Data))
                    {
                        Log("[DEV-ERR] " + e.Data);
                    }
                };

                _devProcess.Start();
                _devProcess.BeginOutputReadLine();
                _devProcess.BeginErrorReadLine();

                Log("[0xAgent Launcher] Process started with PID: " + _devProcess.Id);
            }
            catch (Exception ex)
            {
                Log("[0xAgent Launcher] ERROR starting process: " + ex.Message);
                MessageBox.Show("Не удалось запустить 0xAgent: " + ex.Message, "0xAgent Launcher Error", MessageBoxButtons.OK, MessageBoxIcon.Error);
            }
        }

        private void KillStalePorts()
        {
            try
            {
                string cleanupScript = Path.Combine(_projectDir, "scripts", "cleanup.ps1");
                if (File.Exists(cleanupScript))
                {
                    ProcessStartInfo psi = new ProcessStartInfo
                    {
                        FileName = "powershell.exe",
                        Arguments = string.Format("-NoProfile -ExecutionPolicy Bypass -File \"{0}\" -Quiet", cleanupScript),
                        WorkingDirectory = _projectDir,
                        CreateNoWindow = true,
                        UseShellExecute = false,
                        WindowStyle = ProcessWindowStyle.Hidden
                    };
                    using (Process p = Process.Start(psi))
                    {
                        if (p != null) p.WaitForExit(3000);
                    }
                }
            }
            catch {}
        }

        private void HealthTimer_Tick(object sender, EventArgs e)
        {
            if (_isShuttingDown) return;

            ThreadPool.QueueUserWorkItem(_ =>
            {
                bool isServerUp = false;
                bool isClientUp = false;

                try
                {
                    HttpWebRequest req1 = (HttpWebRequest)WebRequest.Create("https://127.0.0.1:3001/api/auth/status");
                    req1.Timeout = 1500;
                    using (HttpWebResponse res1 = (HttpWebResponse)req1.GetResponse())
                    {
                        isServerUp = (res1.StatusCode == HttpStatusCode.OK);
                    }
                }
                catch
                {
                    try
                    {
                        HttpWebRequest req1Http = (HttpWebRequest)WebRequest.Create("http://127.0.0.1:3001/api/auth/status");
                        req1Http.Timeout = 1000;
                        using (HttpWebResponse res1Http = (HttpWebResponse)req1Http.GetResponse())
                        {
                            isServerUp = (res1Http.StatusCode == HttpStatusCode.OK);
                        }
                    }
                    catch {}
                }

                try
                {
                    HttpWebRequest req2 = (HttpWebRequest)WebRequest.Create("https://127.0.0.1:5173");
                    req2.Timeout = 1500;
                    using (HttpWebResponse res2 = (HttpWebResponse)req2.GetResponse())
                    {
                        isClientUp = (res2.StatusCode == HttpStatusCode.OK);
                    }
                }
                catch
                {
                    try
                    {
                        HttpWebRequest req2Http = (HttpWebRequest)WebRequest.Create("http://127.0.0.1:5173");
                        req2Http.Timeout = 1000;
                        using (HttpWebResponse res2Http = (HttpWebResponse)req2Http.GetResponse())
                        {
                            isClientUp = (res2Http.StatusCode == HttpStatusCode.OK);
                        }
                    }
                    catch {}
                }

                if (!_hasAutoOpenedBrowser && (isServerUp || isClientUp))
                {
                    _hasAutoOpenedBrowser = true;
                    OpenWebUI();
                }

                if (_statusMenuItem != null && !_isShuttingDown)
                {
                    try
                    {
                        Control parent = _statusMenuItem.GetCurrentParent();
                        if (parent != null)
                        {
                            parent.BeginInvoke(new Action(delegate()
                            {
                                bool isEn = GetAppLanguage() == "en";
                                if (isServerUp && isClientUp)
                                {
                                    _statusMenuItem.Text = isEn ? "📊  Status: Online (HTTPS 3001, 5173)" : "📊  Статус: Online (HTTPS 3001, 5173)";
                                    _notifyIcon.Text = isEn ? "0xAgent AI Platform — Online (HTTPS)" : "0xAgent AI Platform — Онлайн (HTTPS)";
                                }
                                else if (isServerUp)
                                {
                                    _statusMenuItem.Text = isEn ? "📊  Status: Server ready (:3001)" : "📊  Статус: Сервер готов (:3001)";
                                    _notifyIcon.Text = isEn ? "0xAgent Server — Ready" : "0xAgent Сервер — Готов";
                                }
                                else
                                {
                                    _statusMenuItem.Text = isEn ? "📊  Status: Starting services..." : "📊  Статус: Запуск сервисов...";
                                    _notifyIcon.Text = isEn ? "0xAgent — Starting..." : "0xAgent — Запуск...";
                                }

                                if (_veronicaMenuItem != null)
                                {
                                    if (isServerUp)
                                    {
                                        _veronicaMenuItem.Text = isEn ? "🤖  Veronica: Online & Ready" : "🤖  Вероника: Онлайн и Готова";
                                    }
                                    else
                                    {
                                        _veronicaMenuItem.Text = isEn ? "🤖  Veronica: Standby" : "🤖  Вероника: Ожидание";
                                    }
                                }
                            }));
                        }
                    }
                    catch {}
                }
            });
        }

        private void OpenWebUI()
        {
            try
            {
                string lanIp = GetPrimaryLanAddress();
                Process.Start(new ProcessStartInfo
                {
                    FileName = string.Format("https://{0}:5173", lanIp),
                    UseShellExecute = true
                });
            }
            catch (Exception ex)
            {
                Log("[0xAgent Launcher] Failed to open browser: " + ex.Message);
            }
        }

        private void OpenLogs()
        {
            try
            {
                if (File.Exists(_logFilePath))
                {
                    Process.Start("notepad.exe", _logFilePath);
                }
                else
                {
                    MessageBox.Show("Файл логов пока не создан: " + _logFilePath, "0xAgent Logs", MessageBoxButtons.OK, MessageBoxIcon.Information);
                }
            }
            catch (Exception ex)
            {
                MessageBox.Show("Ошибка открытия логов: " + ex.Message, "0xAgent Error", MessageBoxButtons.OK, MessageBoxIcon.Error);
            }
        }

        private void CheckForUpdates()
        {
            try
            {
                Log("[0xAgent Launcher] Checking updates via CLI...");
                ProcessStartInfo psi = new ProcessStartInfo
                {
                    FileName = "cmd.exe",
                    Arguments = "/c node bin\\0xagent.js update",
                    WorkingDirectory = _projectDir,
                    CreateNoWindow = false,
                    UseShellExecute = true
                };
                Process.Start(psi);
            }
            catch (Exception ex)
            {
                MessageBox.Show("Не удалось запустить проверку обновлений: " + ex.Message, "0xAgent Updates", MessageBoxButtons.OK, MessageBoxIcon.Error);
            }
        }


        private void RestartServices()
        {
            Log("[0xAgent Launcher] Restarting services...");
            StopChildProcesses();
            Thread.Sleep(1000);
            StartServices();
            if (_notifyIcon != null)
            {
                _notifyIcon.ShowBalloonTip(2000, "0xAgent", "Платформа перезапущена.", ToolTipIcon.Info);
            }
        }

        private void StopChildProcesses()
        {
            try
            {
                if (_devProcess != null && !_devProcess.HasExited)
                {
                    _devProcess.Kill();
                }
            }
            catch {}
            KillStalePorts();
        }

        private void ExitApplication()
        {
            _isShuttingDown = true;
            Log("[0xAgent Launcher] Terminating application and cleaning up all processes...");

            if (_healthTimer != null)
            {
                _healthTimer.Stop();
                _healthTimer.Dispose();
            }

            if (_notifyIcon != null)
            {
                _notifyIcon.Visible = false;
                _notifyIcon.Dispose();
            }

            StopChildProcesses();

            try
            {
                if (_logWriter != null)
                {
                    _logWriter.Flush();
                    _logWriter.Close();
                }
            }
            catch {}

            Application.Exit();
        }
    }

    public static class Program
    {
        private const string MutexName = "Global\\0xAgent_Single_Instance_Mutex_Unique";

        [STAThread]
        public static void Main()
        {
            bool createdNew;
            using (Mutex mutex = new Mutex(true, MutexName, out createdNew))
            {
                if (!createdNew)
                {
                    // Already running -> open Web UI in browser
                    try
                    {
                        string lanIp = TrayApplicationContext.GetPrimaryLanAddress();
                        Process.Start(new ProcessStartInfo
                        {
                            FileName = string.Format("https://{0}:5173", lanIp),
                            UseShellExecute = true
                        });
                    }
                    catch {}
                    return;
                }

                Application.EnableVisualStyles();
                Application.SetCompatibleTextRenderingDefault(false);
                Application.Run(new TrayApplicationContext());
            }
        }
    }
}
