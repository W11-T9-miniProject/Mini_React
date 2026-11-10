param([Parameter(Mandatory)][ValidateSet('T1','T2','T3','T4','T5','T6','T7')][string]$Role)
$ErrorActionPreference = 'Stop'
$bindings = Get-Content -LiteralPath (Join-Path $PSScriptRoot 'terminal-team-bindings.json') -Raw -Encoding UTF8 | ConvertFrom-Json
$binding = $bindings.roles.$Role
$projectRoot = Split-Path -Parent $PSScriptRoot
$requestFile = Join-Path $projectRoot "logs/orca-requests/$Role.json"
$request = Get-Content -LiteralPath $requestFile -Raw -Encoding UTF8 | ConvertFrom-Json
$cliExecutable = 'C:/Users/wotjd/AppData/Local/Programs/orca/resources/bin/orca.exe'
if ($bindings.cli -cne $cliExecutable -or -not $binding.handle) { throw 'Invalid protected Orca binding.' }
function Get-MessageField([string]$Name, [int]$MaximumLength) {
    $value = $request.$Name
    if ($value -isnot [string] -or [string]::IsNullOrWhiteSpace($value) -or $value.Length -gt $MaximumLength) {
        throw "Invalid message field: $Name"
    }
    return $value
}
# Every argv token below is either fixed or a validated data field; no shell
# strings are evaluated. The request cannot select an executable or raw argv.
switch ($request.operation) {
    'guide' { $orcaArguments = @('skills','get','orchestration') }
    'status' { $orcaArguments = @('orchestration','worker-list','--run',$bindings.run) }
    'check' { $orcaArguments = @('orchestration','check','--from',$binding.handle,'--run',$bindings.run) }
    'done' {
        if (-not $binding.task -or -not $binding.dispatch) { throw 'No active task is bound to this role.' }
        if ($request.outcome -cnotin @('succeeded','failed')) { throw 'Invalid task outcome.' }
        $subject = Get-MessageField 'subject' 200
        $body = Get-MessageField 'body' 16000
        $orcaArguments = @('orchestration','send','--from',$binding.handle,'--type','worker_done','--subject',$subject,'--body',$body,'--task-id',$binding.task,'--dispatch-id',$binding.dispatch,'--outcome',$request.outcome,'--json')
    }
    'message' {
        if ($request.to -cnotin @('T1','T2','T3','T4','T5','T6','T7')) { throw 'Recipient must be a configured team role.' }
        $receiver = $bindings.roles.($request.to).handle
        $subject = Get-MessageField 'subject' 200
        $body = Get-MessageField 'body' 16000
        $orcaArguments = @('orchestration','send','--from',$binding.handle,'--to',$receiver,'--type','status','--subject',$subject,'--body',$body,'--json')
    }
    default { throw 'Only guide, status, check, done and message operations are allowed.' }
}
& $cliExecutable @orcaArguments
exit $LASTEXITCODE
