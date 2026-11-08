using System;
using System.Diagnostics;
using System.Drawing;
using System.IO;
using System.Net;
using System.Net.Sockets;
using System.Runtime.InteropServices;
using System.Threading;
using System.Threading.Tasks;
using System.Windows.Forms;
using Microsoft.Web.WebView2.Core;
using Microsoft.Web.WebView2.WinForms;

static class Program {
 [STAThread] static int Main(string[] args) {
  using(var mutex=new Mutex(true,"Local\\FDUDash.Desktop",out bool first)) {
   if(!first){MessageBox.Show("FDUDash 已在运行，请切换到现有窗口。","FDUDash");return 0;}
   Application.EnableVisualStyles(); Application.SetCompatibleTextRenderingDefault(false);
   bool smoke=Array.IndexOf(args,"--smoke-test")>=0;
   using(var form=new MainWindow(smoke)){Application.Run(form);return form.Result;}
  }
 }
}
sealed class MainWindow:Form {
 readonly WebView2 web=new WebView2{Dock=DockStyle.Fill};
 readonly Label loading=new Label{Text="正在启动 FDUDash…",Dock=DockStyle.Fill,TextAlign=ContentAlignment.MiddleCenter};
 readonly bool smoke; Process backend; IntPtr job; string origin; bool closing;
 public int Result=1;
 public MainWindow(bool smoke){this.smoke=smoke;Text="FDUDash";Icon=System.Drawing.Icon.ExtractAssociatedIcon(Application.ExecutablePath);Width=1200;Height=820;MinimumSize=new Size(800,600);StartPosition=FormStartPosition.CenterScreen;Controls.Add(loading);Shown+=async(s,e)=>await Start();FormClosed+=(s,e)=>Stop();}
 async Task Start(){try{
  CoreWebView2Environment.GetAvailableBrowserVersionString();
  int port=5187;
  origin="http://127.0.0.1:"+port;string nonce=Guid.NewGuid().ToString("N");
  string root=AppDomain.CurrentDomain.BaseDirectory;
  var info=new ProcessStartInfo(Path.Combine(root,"backend","runtime","node.exe"),"server.mjs"){WorkingDirectory=Path.Combine(root,"backend"),UseShellExecute=false,CreateNoWindow=true,RedirectStandardOutput=true,RedirectStandardError=true};
  info.EnvironmentVariables["PORT"]=port.ToString();info.EnvironmentVariables["FDUDASH_HOSTED"]="0";info.EnvironmentVariables["FDUDASH_DESKTOP"]="1";info.EnvironmentVariables["FDUDASH_DESKTOP_TOKEN"]=nonce;
  job=Jobs.Create();backend=Process.Start(info);Jobs.Assign(job,backend.Handle);backend.BeginOutputReadLine();backend.BeginErrorReadLine();
  bool ready=false;for(int i=0;i<600&&!closing;i++){if(backend.HasExited)throw new Exception("本地服务启动失败，请重新解压完整应用包。");try{using(var client=new WebClient()){client.Proxy=null;client.Headers["X-FDUDash-Desktop"]=nonce;ready=await client.DownloadStringTaskAsync(origin+"/desktop/health")=="ready";}}catch(WebException){}if(ready)break;await Task.Delay(100);}
  if(closing)return;if(!ready)throw new Exception("本地服务启动超时。");
  var env=await CoreWebView2Environment.CreateAsync(null,Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),"FDUDash","WebView2"));
  if(closing)return;Controls.Add(web);await web.EnsureCoreWebView2Async(env);
  web.CoreWebView2.Settings.AreDevToolsEnabled=false;web.CoreWebView2.Settings.IsWebMessageEnabled=false;
  web.CoreWebView2.Settings.IsPasswordAutosaveEnabled=false;web.CoreWebView2.Settings.IsGeneralAutofillEnabled=false;
  web.CoreWebView2.NewWindowRequested+=(s,e)=>{e.Handled=true;OpenExternal(e.Uri);};
  web.CoreWebView2.NavigationStarting+=(s,e)=>{if(!IsLocal(e.Uri)){e.Cancel=true;OpenExternal(e.Uri);}};
  web.CoreWebView2.PermissionRequested+=(s,e)=>e.State=CoreWebView2PermissionState.Deny;
  web.CoreWebView2.NavigationCompleted+=async(s,e)=>{if(!e.IsSuccess){Result=1;if(smoke)Close();return;}loading.Visible=false;web.BringToFront();if(smoke){var ok=await web.CoreWebView2.ExecuteScriptAsync("!!document.querySelector('#nav-dashboard')");Result=ok=="true"?0:1;Close();}};
  web.CoreWebView2.Navigate(origin+"/");
  if(smoke){await Task.Delay(30000);if(!closing){Result=1;Close();}}
 }catch(Exception e){if(!smoke)MessageBox.Show(e is WebView2RuntimeNotFoundException?"请先安装 Microsoft Edge WebView2 Runtime，再打开 FDUDash。下载地址见 README.txt。":e.Message,"FDUDash",MessageBoxButtons.OK,MessageBoxIcon.Error);Result=1;Close();}}
 bool IsLocal(string value){return Uri.TryCreate(value,UriKind.Absolute,out var u)&&u.GetLeftPart(UriPartial.Authority)==origin;}
 void OpenExternal(string value){if(Uri.TryCreate(value,UriKind.Absolute,out var u)&&(u.Scheme=="https"||u.Scheme=="http")&&!IsLocal(value))Process.Start(new ProcessStartInfo(value){UseShellExecute=true});}
 void Stop(){closing=true;web.Dispose();if(job!=IntPtr.Zero){Jobs.CloseHandle(job);job=IntPtr.Zero;}if(backend!=null){try{if(!backend.HasExited)backend.Kill();}catch(InvalidOperationException){}backend.Dispose();}}
}
static class Jobs {
 [StructLayout(LayoutKind.Sequential)] struct Basic {public long PerProcessUserTimeLimit,PerJobUserTimeLimit;public uint LimitFlags;public UIntPtr MinimumWorkingSetSize,MaximumWorkingSetSize;public uint ActiveProcessLimit;public UIntPtr Affinity;public uint PriorityClass,SchedulingClass;}
 [StructLayout(LayoutKind.Sequential)] struct IO {public ulong ReadOperationCount,WriteOperationCount,OtherOperationCount,ReadTransferCount,WriteTransferCount,OtherTransferCount;}
 [StructLayout(LayoutKind.Sequential)] struct Extended {public Basic BasicLimitInformation;public IO IoInfo;public UIntPtr ProcessMemoryLimit,JobMemoryLimit,PeakProcessMemoryUsed,PeakJobMemoryUsed;}
 [DllImport("kernel32.dll",CharSet=CharSet.Unicode)] static extern IntPtr CreateJobObject(IntPtr attrs,string name);
 [DllImport("kernel32.dll")] static extern bool SetInformationJobObject(IntPtr job,int cls,ref Extended info,uint size);
 [DllImport("kernel32.dll")] static extern bool AssignProcessToJobObject(IntPtr job,IntPtr process);
 [DllImport("kernel32.dll")] public static extern bool CloseHandle(IntPtr handle);
 public static IntPtr Create(){var job=CreateJobObject(IntPtr.Zero,null);var info=new Extended();info.BasicLimitInformation.LimitFlags=0x2000;if(job==IntPtr.Zero||!SetInformationJobObject(job,9,ref info,(uint)Marshal.SizeOf(info))){if(job!=IntPtr.Zero)CloseHandle(job);throw new Exception("无法初始化本地服务生命周期。");}return job;}
 public static void Assign(IntPtr job,IntPtr process){if(!AssignProcessToJobObject(job,process))throw new Exception("无法绑定本地服务生命周期。");}
}
