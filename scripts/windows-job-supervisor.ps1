param([Parameter(Mandatory = $true)][string]$Payload)

$ErrorActionPreference = 'Stop'

Add-Type -TypeDefinition @'
using System;
using System.ComponentModel;
using System.Runtime.InteropServices;
using System.Text;

public static class ProjectorJobSupervisor {
    [StructLayout(LayoutKind.Sequential)]
    private struct BasicLimitInformation {
        public long PerProcessUserTimeLimit;
        public long PerJobUserTimeLimit;
        public uint LimitFlags;
        public UIntPtr MinimumWorkingSetSize;
        public UIntPtr MaximumWorkingSetSize;
        public uint ActiveProcessLimit;
        public IntPtr Affinity;
        public uint PriorityClass;
        public uint SchedulingClass;
    }

    [StructLayout(LayoutKind.Sequential)]
    private struct IoCounters {
        public ulong ReadOperationCount;
        public ulong WriteOperationCount;
        public ulong OtherOperationCount;
        public ulong ReadTransferCount;
        public ulong WriteTransferCount;
        public ulong OtherTransferCount;
    }

    [StructLayout(LayoutKind.Sequential)]
    private struct ExtendedLimitInformation {
        public BasicLimitInformation BasicLimitInformation;
        public IoCounters IoInfo;
        public UIntPtr ProcessMemoryLimit;
        public UIntPtr JobMemoryLimit;
        public UIntPtr PeakProcessMemoryUsed;
        public UIntPtr PeakJobMemoryUsed;
    }

    [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)]
    private struct StartupInfo {
        public uint Size;
        public string Reserved;
        public string Desktop;
        public string Title;
        public uint X;
        public uint Y;
        public uint XSize;
        public uint YSize;
        public uint XCountChars;
        public uint YCountChars;
        public uint FillAttribute;
        public uint Flags;
        public short ShowWindow;
        public short Reserved2;
        public IntPtr ReservedBytes;
        public IntPtr StandardInput;
        public IntPtr StandardOutput;
        public IntPtr StandardError;
    }

    [StructLayout(LayoutKind.Sequential)]
    private struct ProcessInformation {
        public IntPtr Process;
        public IntPtr Thread;
        public uint ProcessId;
        public uint ThreadId;
    }

    [DllImport("kernel32.dll", SetLastError = true)]
    private static extern IntPtr CreateJobObject(IntPtr attributes, string name);

    [DllImport("kernel32.dll", SetLastError = true)]
    private static extern bool SetInformationJobObject(IntPtr job, int informationClass, ref ExtendedLimitInformation information, uint length);

    [DllImport("kernel32.dll", SetLastError = true)]
    private static extern bool AssignProcessToJobObject(IntPtr job, IntPtr process);

    [DllImport("kernel32.dll")]
    private static extern IntPtr GetCurrentProcess();

    [DllImport("kernel32.dll")]
    private static extern IntPtr GetStdHandle(int kind);

    [DllImport("kernel32.dll", SetLastError = true)]
    private static extern bool SetHandleInformation(IntPtr handle, uint mask, uint flags);

    [DllImport("kernel32.dll", CharSet = CharSet.Unicode, SetLastError = true)]
    private static extern bool CreateProcess(string application, StringBuilder commandLine, IntPtr processAttributes,
        IntPtr threadAttributes, bool inheritHandles, uint creationFlags, IntPtr environment, string cwd,
        ref StartupInfo startup, out ProcessInformation process);

    [DllImport("kernel32.dll")]
    private static extern uint WaitForSingleObject(IntPtr handle, uint milliseconds);

    [DllImport("kernel32.dll", SetLastError = true)]
    private static extern bool GetExitCodeProcess(IntPtr process, out uint exitCode);

    [DllImport("kernel32.dll")]
    private static extern bool CloseHandle(IntPtr handle);

    // This handle belongs to the supervisor process. The operating system closes
    // it on every exit path, terminating the whole job, even after the root exits.
    private static IntPtr jobHandle;

    private static string Quote(string value) {
        if (value.Length > 0 && value.IndexOfAny(new[] { ' ', '\t', '\n', '"' }) < 0) return value;
        var result = new StringBuilder("\"");
        var slashes = 0;
        foreach (var character in value) {
            if (character == '\\') { slashes++; continue; }
            if (character == '"') {
                result.Append('\\', slashes * 2 + 1);
                result.Append('"');
                slashes = 0;
                continue;
            }
            result.Append('\\', slashes);
            slashes = 0;
            result.Append(character);
        }
        result.Append('\\', slashes * 2);
        return result.Append('"').ToString();
    }

    public static int Run(string file, string[] arguments, string cwd) {
        jobHandle = CreateJobObject(IntPtr.Zero, null);
        if (jobHandle == IntPtr.Zero) throw new Win32Exception(Marshal.GetLastWin32Error(), "CreateJobObject failed");
        var information = new ExtendedLimitInformation();
        information.BasicLimitInformation.LimitFlags = 0x00002000; // JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE
        if (!SetInformationJobObject(jobHandle, 9, ref information, (uint)Marshal.SizeOf(typeof(ExtendedLimitInformation))))
            throw new Win32Exception(Marshal.GetLastWin32Error(), "SetInformationJobObject failed");
        if (!AssignProcessToJobObject(jobHandle, GetCurrentProcess()))
            throw new Win32Exception(Marshal.GetLastWin32Error(), "AssignProcessToJobObject failed");

        var start = new StartupInfo();
        start.Size = (uint)Marshal.SizeOf(typeof(StartupInfo));
        start.Flags = 0x00000100; // STARTF_USESTDHANDLES
        start.StandardInput = GetStdHandle(-10);
        start.StandardOutput = GetStdHandle(-11);
        start.StandardError = GetStdHandle(-12);
        foreach (var handle in new[] { start.StandardInput, start.StandardOutput, start.StandardError }) {
            if (!SetHandleInformation(handle, 1, 1))
                throw new Win32Exception(Marshal.GetLastWin32Error(), "Standard handle inheritance failed");
        }
        var command = new StringBuilder(Quote(file) + " " + string.Join(" ", Array.ConvertAll(arguments, Quote)));
        ProcessInformation created;
        if (!CreateProcess(null, command, IntPtr.Zero, IntPtr.Zero, true, 0x08000000, IntPtr.Zero, cwd, ref start, out created))
            throw new Win32Exception(Marshal.GetLastWin32Error(), "Supervised process could not start");
        try {
            if (WaitForSingleObject(created.Process, 0xffffffff) != 0)
                throw new Win32Exception(Marshal.GetLastWin32Error(), "Supervised process wait failed");
            uint code;
            if (!GetExitCodeProcess(created.Process, out code))
                throw new Win32Exception(Marshal.GetLastWin32Error(), "Supervised exit status could not be read");
            return unchecked((int)code);
        } finally {
            CloseHandle(created.Thread);
            CloseHandle(created.Process);
        }
    }
}
'@

$request = [Text.Encoding]::UTF8.GetString([Convert]::FromBase64String($Payload)) | ConvertFrom-Json
if (-not $request.file -or -not $request.cwd -or $null -eq $request.args) { throw 'Invalid supervised command request' }
try {
    $code = [ProjectorJobSupervisor]::Run([string]$request.file, [string[]]$request.args, [string]$request.cwd)
    [Environment]::Exit($code)
} catch {
    $native = $_.Exception.InnerException
    if ($native -is [System.ComponentModel.Win32Exception] -and $native.NativeErrorCode -in @(2, 3)) {
        [Console]::Error.WriteLine('PROJECTOR_SUPERVISOR_SPAWN_ERROR:ENOENT')
        [Environment]::Exit(127)
    }
    throw
}
