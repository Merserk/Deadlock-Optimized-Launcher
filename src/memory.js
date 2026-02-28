const os = require('os');
const koffi = require('koffi');

const PROCESS_QUERY_INFORMATION = 0x0400;
const PROCESS_SET_QUOTA = 0x0100;
const TOKEN_QUERY = 0x0008;
const TOKEN_ADJUST_PRIVILEGES = 0x0020;
const SE_PRIVILEGE_ENABLED = 0x00000002;
const ERROR_NOT_ALL_ASSIGNED = 1300;
const SYSTEM_MEMORY_LIST_INFORMATION = 80;
const STATUS_PRIVILEGE_NOT_HELD = 0xC0000061;

const MEMORY_LIST_COMMAND = Object.freeze({
    MemoryEmptyWorkingSets: 2,
    MemoryFlushModifiedList: 3,
    MemoryPurgeStandbyList: 4,
    MemoryPurgeLowPriorityStandbyList: 5
});

const kernel32 = koffi.load('kernel32.dll');
const advapi32 = koffi.load('advapi32.dll');
const psapi = koffi.load('psapi.dll');
const ntdll = koffi.load('ntdll.dll');

const DWORD = koffi.alias('DWORD', 'uint32');
const HANDLE = koffi.pointer('HANDLE', koffi.opaque());
const LUID = koffi.struct('LUID', {
    LowPart: 'uint32',
    HighPart: 'int32'
});
const LUID_AND_ATTRIBUTES = koffi.struct('LUID_AND_ATTRIBUTES', {
    Luid: LUID,
    Attributes: 'uint32'
});
const TOKEN_PRIVILEGES = koffi.struct('TOKEN_PRIVILEGES', {
    PrivilegeCount: 'uint32',
    Privileges: koffi.array(LUID_AND_ATTRIBUTES, 1)
});

const GetCurrentProcess = kernel32.func('HANDLE __stdcall GetCurrentProcess(void)');
const GetLastError = kernel32.func('DWORD __stdcall GetLastError(void)');
const OpenProcessToken = advapi32.func('int __stdcall OpenProcessToken(HANDLE ProcessHandle, DWORD DesiredAccess, _Out_ HANDLE *TokenHandle)');
const LookupPrivilegeValueW = advapi32.func('int __stdcall LookupPrivilegeValueW(const char16_t *lpSystemName, const char16_t *lpName, _Out_ LUID *lpLuid)');
const AdjustTokenPrivileges = advapi32.func('int __stdcall AdjustTokenPrivileges(HANDLE TokenHandle, int DisableAllPrivileges, _In_ TOKEN_PRIVILEGES *NewState, DWORD BufferLength, void *PreviousState, void *ReturnLength)');
const OpenProcess = kernel32.func('HANDLE __stdcall OpenProcess(DWORD dwDesiredAccess, int bInheritHandle, DWORD dwProcessId)');
const CloseHandle = kernel32.func('int __stdcall CloseHandle(HANDLE hObject)');
const EmptyWorkingSet = psapi.func('int __stdcall EmptyWorkingSet(HANDLE hProcess)');
const EnumProcesses = psapi.func('int __stdcall EnumProcesses(_Out_ DWORD *lpidProcess, DWORD cb, _Out_ DWORD *lpcbNeeded)');
const NtSetSystemInformation = ntdll.func('int32_t __stdcall NtSetSystemInformation(uint32_t SystemInformationClass, const uint32_t *SystemInformation, uint32_t SystemInformationLength)');

function getProcessIds() {
    let maxPids = 4096;

    while (maxPids <= 262144) {
        const pids = new Uint32Array(maxPids);
        const bytesNeeded = [0];
        const ok = EnumProcesses(pids, pids.byteLength, bytesNeeded);
        if (!ok) throw new Error('EnumProcesses failed');

        if (bytesNeeded[0] < pids.byteLength) {
            const count = Math.floor(bytesNeeded[0] / Uint32Array.BYTES_PER_ELEMENT);
            return Array.from(pids.slice(0, count)).filter(pid => pid > 4);
        }

        maxPids *= 2;
    }

    throw new Error('Process list is too large to enumerate');
}

function emptyAllWorkingSets() {
    const pids = getProcessIds();

    for (const pid of pids) {
        const processHandle = OpenProcess(PROCESS_QUERY_INFORMATION | PROCESS_SET_QUOTA, 0, pid);
        if (!processHandle) continue;

        try {
            // Some protected processes can still fail here, which is expected.
            EmptyWorkingSet(processHandle);
        } finally {
            CloseHandle(processHandle);
        }
    }
}

function formatNtStatus(status) {
    return `0x${(status >>> 0).toString(16).toUpperCase().padStart(8, '0')}`;
}

function enablePrivilege(tokenHandle, privilegeName) {
    const luid = {};
    if (!LookupPrivilegeValueW(null, privilegeName, luid)) {
        return false;
    }

    const privileges = {
        PrivilegeCount: 1,
        Privileges: [{
            Luid: luid,
            Attributes: SE_PRIVILEGE_ENABLED
        }]
    };

    const adjusted = AdjustTokenPrivileges(tokenHandle, 0, privileges, 0, null, null);
    const lastError = GetLastError();
    return Boolean(adjusted) && lastError !== ERROR_NOT_ALL_ASSIGNED;
}

function enableMemoryOptimizationPrivileges() {
    const tokenHandleOut = [null];
    const processHandle = GetCurrentProcess();
    const opened = OpenProcessToken(processHandle, TOKEN_QUERY | TOKEN_ADJUST_PRIVILEGES, tokenHandleOut);
    if (!opened || !tokenHandleOut[0]) {
        return {
            SeProfileSingleProcessPrivilege: false,
            SeIncreaseQuotaPrivilege: false,
            SeDebugPrivilege: false
        };
    }

    const tokenHandle = tokenHandleOut[0];
    try {
        return {
            SeProfileSingleProcessPrivilege: enablePrivilege(tokenHandle, 'SeProfileSingleProcessPrivilege'),
            SeIncreaseQuotaPrivilege: enablePrivilege(tokenHandle, 'SeIncreaseQuotaPrivilege'),
            SeDebugPrivilege: enablePrivilege(tokenHandle, 'SeDebugPrivilege')
        };
    } finally {
        CloseHandle(tokenHandle);
    }
}

function runMemoryListCommand(command, description) {
    const status = NtSetSystemInformation(
        SYSTEM_MEMORY_LIST_INFORMATION,
        [command],
        Uint32Array.BYTES_PER_ELEMENT
    );
    if (status < 0) {
        const error = new Error(`${description} failed with NTSTATUS ${formatNtStatus(status)}`);
        error.ntstatus = status >>> 0;
        throw error;
    }
}

function emitProgress(mainWindow, payload) {
    if (!mainWindow || mainWindow.isDestroyed()) return;
    mainWindow.webContents.send('launch-progress', payload);
}

async function optimizeRam(mainWindow) {
    try {
        if (process.platform !== 'win32') {
            throw new Error('RAM optimization is only supported on Windows');
        }

        const privilegeState = enableMemoryOptimizationPrivileges();
        if (!privilegeState.SeProfileSingleProcessPrivilege) {
            console.warn('SeProfileSingleProcessPrivilege is not enabled. Some memory cleanup steps may be limited.');
        }

        const initialMem = Math.round(os.freemem() / (1024 * 1024));
        const steps = [
            'Emptying Working Sets...',
            'Clearing System Working Sets...',
            'Emptying Modified Page List...',
            'Clearing Standby List...',
            'Emptying Priority 0 Standby List...'
        ];
        const optimizers = [
            () => emptyAllWorkingSets(),
            () => runMemoryListCommand(MEMORY_LIST_COMMAND.MemoryEmptyWorkingSets, 'System working set trim'),
            () => runMemoryListCommand(MEMORY_LIST_COMMAND.MemoryFlushModifiedList, 'Modified page list flush'),
            () => runMemoryListCommand(MEMORY_LIST_COMMAND.MemoryPurgeStandbyList, 'Standby list purge'),
            () => runMemoryListCommand(MEMORY_LIST_COMMAND.MemoryPurgeLowPriorityStandbyList, 'Priority 0 standby list purge')
        ];
        const softFailures = [];

        for (let i = 0; i < optimizers.length; i++) {
            emitProgress(mainWindow, { step: steps[i], progress: (i / optimizers.length) * 100 });
            try {
                optimizers[i]();
            } catch (error) {
                if (error.ntstatus === STATUS_PRIVILEGE_NOT_HELD) {
                    softFailures.push(`${steps[i]} skipped (missing required token privilege).`);
                } else {
                    throw error;
                }
            }
            await new Promise(resolve => setTimeout(resolve, 600));
        }

        await new Promise(resolve => setTimeout(resolve, 500));
        const finalMem = Math.round(os.freemem() / (1024 * 1024));
        const freed = Math.max(0, finalMem - initialMem);

        emitProgress(mainWindow, { step: 'Optimization Complete', progress: 100, freed });
        return { success: true, freed, warnings: softFailures };
    } catch (error) {
        console.error('Optimization error', error);
        return { success: false, error: error.message };
    }
}

module.exports = {
    optimizeRam
};