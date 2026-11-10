#Requires -Version 7.4
[CmdletBinding()]
param(
    [Parameter(Mandatory)]
    [ValidateNotNullOrEmpty()]
    [string] $Task,

    [ValidateRange(0, 5)]
    [int] $MaxRetries = 5,

    [switch] $BrowserCheck,
    [switch] $PlanOnly,
    [switch] $DryRun
)

$ErrorActionPreference = 'Stop'
$PSNativeCommandUseErrorActionPreference = $false
$OutputEncoding = [System.Text.UTF8Encoding]::new($false)
[Console]::OutputEncoding = $OutputEncoding
$env:NO_COLOR = '1'

if ([string]::IsNullOrWhiteSpace($Task)) {
    throw 'Provide a task with a concrete acceptance criterion.'
}

if ($DryRun) {
    Write-Host 'PREFLIGHT -> DESIGN -> SCOPE -> IMPLEMENT -> SCOPE -> VERIFY -> REVIEW -> DONE or NEEDS_BROWSER_CHECK'
    Write-Host "VERIFY or REVIEW can return to IMPLEMENT up to $MaxRetries time(s)."
    Write-Host "Browser check requested: $($BrowserCheck.IsPresent)"
    Write-Host "Task: $Task"
    return
}

function Assert-ChangeScope($baseline, $allowedFiles) {
    $head = git rev-parse --verify HEAD
    if ($LASTEXITCODE -ne 0 -or $head -ne $baseline) { throw 'BASELINE_CHANGED: HEAD changed.' }
    git diff --cached --quiet $baseline --
    if ($LASTEXITCODE -ne 0) { throw 'INDEX_CHECK_FAILED: The index could not be verified as unchanged.' }

    $tracked = @(git -c core.quotepath=false diff --name-only --no-renames $baseline --)
    if ($LASTEXITCODE -ne 0) { throw 'SCOPE_FAILED: Could not list tracked changes.' }
    $untracked = @(git -c core.quotepath=false ls-files --others --exclude-standard)
    if ($LASTEXITCODE -ne 0) { throw 'SCOPE_FAILED: Could not list untracked files.' }
    $outside = @($tracked + $untracked | Where-Object { $_ -cnotin $allowedFiles })
    if ($outside.Count -gt 0) {
        throw "OUT_OF_SCOPE: $($outside -join ', '). Inspect the working tree before continuing."
    }
}

Push-Location -LiteralPath (Join-Path $PSScriptRoot '..')
$stage = 'PREFLIGHT'
$stageLog = $null
try {
    $baseline = git rev-parse --verify HEAD
    if ($LASTEXITCODE -ne 0) { throw 'PREFLIGHT_FAILED: Could not resolve the baseline commit.' }

    $workingChanges = git status --porcelain=v1 --untracked-files=all
    if ($LASTEXITCODE -ne 0) { throw 'PREFLIGHT_FAILED: Could not inspect the working tree.' }
    if ($workingChanges -and -not $PlanOnly) {
        throw 'PREFLIGHT_FAILED: Start from a clean working tree containing the workflow setup and the intended baseline.'
    }

    Get-Command codex, npm.cmd -ErrorAction Stop | Out-Null
    $runDirectory = [System.IO.Directory]::CreateTempSubdirectory('mini-react-ai-').FullName
    Write-Host "Run logs: $runDirectory"

    $reviewSchemaPath = Join-Path $runDirectory 'review.schema.json'
    @'
{
  "type": "object",
  "properties": {
    "verdict": { "type": "string", "enum": ["pass", "changes_requested", "blocked"] },
    "findings": { "type": "array", "items": { "type": "string" } },
    "browser_check_required": { "type": "boolean" }
  },
  "required": ["verdict", "findings", "browser_check_required"],
  "additionalProperties": false
}
'@ | Set-Content -LiteralPath $reviewSchemaPath -Encoding utf8

    if (-not $PlanOnly) {
        Write-Host 'PREFLIGHT: npm run check'
        $stageLog = Join-Path $runDirectory 'baseline.log'
        npm.cmd run check 2>&1 | Tee-Object -FilePath $stageLog
        if ($LASTEXITCODE -ne 0) { throw 'BASELINE_FAILED: Fix or investigate the baseline before starting this task.' }
        Assert-ChangeScope $baseline @()
    }

    $stage = 'DESIGN'
    $stageLog = Join-Path $runDirectory 'design.log'
    Write-Host "DESIGN: read-only planner (log: $stageLog)"
    $planPath = Join-Path $runDirectory 'plan.json'
    $planSchemaPath = Join-Path $runDirectory 'plan.schema.json'
    @'
{
  "type": "object",
  "properties": {
    "status": { "type": "string", "enum": ["ready", "blocked"] },
    "summary": { "type": "string" },
    "allowed_files": { "type": "array", "items": { "type": "string" } },
    "acceptance_checks": { "type": "array", "items": { "type": "string" } },
    "browser_check_required": { "type": "boolean" }
  },
  "required": ["status", "summary", "allowed_files", "acceptance_checks", "browser_check_required"],
  "additionalProperties": false
}
'@ | Set-Content -LiteralPath $planSchemaPath -Encoding utf8
    $designPrompt = @"
You are the DESIGN node for Mini React. Inspect the source and tests without editing files.
User request:
$Task

Return a proposed implementation in summary, concrete observable acceptance_checks,
and the exact repository-relative files the implementation may change in allowed_files.
The runner permits changes only under src/ or tests/, or to index.html. Use slash-separated
paths with letters, digits, underscores, hyphens, and dots. Include new files if needed.
Set browser_check_required if a real browser check is part of acceptance.
Return blocked and explain why in summary if the request is ambiguous or needs files outside those locations.
"@
    $designPrompt | codex --ask-for-approval never exec --disable apps --color never --sandbox read-only `
        --output-schema $planSchemaPath --output-last-message $planPath - 2>&1 |
        Set-Content -LiteralPath $stageLog -Encoding utf8
    if ($LASTEXITCODE -ne 0 -or -not (Test-Path -LiteralPath $planPath -PathType Leaf)) {
        throw 'DESIGN_FAILED: Codex CLI did not produce a plan.'
    }

    $planJson = Get-Content -LiteralPath $planPath -Raw
    $plan = $planJson | ConvertFrom-Json
    if ($plan.status -eq 'blocked') { throw "DESIGN_BLOCKED: $($plan.summary)" }
    $invalidFiles = @($plan.allowed_files | Where-Object {
        $_ -isnot [string] -or $_ -cnotmatch '^(index\.html|(?:src|tests)/(?:[A-Za-z0-9_-][A-Za-z0-9_.-]*/)*[A-Za-z0-9_-][A-Za-z0-9_.-]*)$'
    })
    if ($plan.status -ne 'ready' -or $plan.summary -isnot [string] -or
        [string]::IsNullOrWhiteSpace($plan.summary) -or $plan.allowed_files -isnot [array] -or
        $invalidFiles.Count -gt 0 -or $plan.acceptance_checks -isnot [array] -or
        $plan.acceptance_checks.Count -eq 0 -or $plan.browser_check_required -isnot [bool] -or
        @($plan.acceptance_checks | Where-Object { $_ -isnot [string] -or [string]::IsNullOrWhiteSpace($_) }).Count -gt 0) {
        throw 'DESIGN_FAILED: Invalid plan or file scope. Inspect the saved plan.'
    }
    Write-Host "SCOPE: $($plan.allowed_files -join ', ')"
    if ($PlanOnly) {
        Write-Host "PLAN_READY: $planPath"
        return
    }
    Assert-ChangeScope $baseline @()

    $feedback = 'First attempt. For a bug, reproduce it before editing. If required information is missing, explain what is needed and leave files untouched.'
    for ($attempt = 1; $attempt -le $MaxRetries + 1; $attempt++) {
        $stage = 'IMPLEMENT'
        $stageLog = Join-Path $runDirectory "implement-$attempt.log"
        Write-Host "IMPLEMENT: attempt $attempt (log: $stageLog)"
        $implementPrompt = @"
You own only the IMPLEMENT step of the Mini React workflow. Follow AGENTS.md.
Task and acceptance criteria:
$Task

Design plan with fixed writable scope and acceptance checks:
$planJson

Evidence from the previous step:
$feedback

Inspect the relevant code and tests, then make the smallest scoped change.
Use the file editing tool, or PowerShell or Node.js when a shell edit is needed. Python is optional.
Edit only the exact allowed_files in the design plan. Keep HEAD and the index unchanged.
Do not commit, push, or edit workflow rules. Report scope blockers without expanding scope.
The runner runs npm run check and requests a separate review after this step.
Summarize the change, reproduction evidence, and any unresolved blocker.
"@
        $implementPrompt | codex --ask-for-approval never exec --disable apps --color never --sandbox workspace-write - 2>&1 |
            Set-Content -LiteralPath $stageLog -Encoding utf8
        if ($LASTEXITCODE -ne 0) { throw 'IMPLEMENT_FAILED: Codex CLI exited with an error.' }

        Assert-ChangeScope $baseline $plan.allowed_files

        $stage = 'VERIFY'
        Write-Host "VERIFY: attempt $attempt"
        $checkLog = Join-Path $runDirectory "verify-$attempt.log"
        $stageLog = $checkLog
        npm.cmd run check 2>&1 | Tee-Object -FilePath $checkLog
        $checkExit = $LASTEXITCODE
        Assert-ChangeScope $baseline $plan.allowed_files
        if ($checkExit -ne 0) {
            $excerpt = (Get-Content -LiteralPath $checkLog -Tail 80) -join "`n"
            $feedback = "npm run check failed. Last 80 lines:`n$excerpt"
            continue
        }

        $stage = 'REVIEW'
        $stageLog = Join-Path $runDirectory "review-$attempt.log"
        Write-Host "REVIEW: attempt $attempt (log: $stageLog)"
        $reviewPath = Join-Path $runDirectory "review-$attempt.json"
        $reviewPrompt = @"
Independently review the Mini React task against its acceptance criteria.
Task and acceptance criteria:
$Task

Design plan and acceptance checks:
$planJson

Baseline commit: $baseline
The runner observed npm run check exit 0 on this attempt.
Inspect git diff against the baseline and inspect untracked files listed by git status.
Verify the original task and design checks even if the diff is empty. Do not edit files.
Flag any user requirement the plan omitted. Use blocked if a fix requires a file outside allowed_files.
Use changes_requested for actionable defects, with a file, line and impact per finding.
Use blocked if evidence or task information is insufficient to review. Explain why in findings.
Use pass with empty findings only if the code meets the task and no fix is needed.
Set browser_check_required if acceptance depends on real browser behavior, such as focus or IME.
"@
        $reviewPrompt | codex --ask-for-approval never exec --disable apps --color never --sandbox read-only `
            --output-schema $reviewSchemaPath --output-last-message $reviewPath - 2>&1 |
            Set-Content -LiteralPath $stageLog -Encoding utf8
        if ($LASTEXITCODE -ne 0 -or -not (Test-Path -LiteralPath $reviewPath -PathType Leaf)) {
            throw 'REVIEW_FAILED: Codex CLI did not produce a review result.'
        }

        try {
            $review = Get-Content -LiteralPath $reviewPath -Raw | ConvertFrom-Json -ErrorAction Stop
        } catch {
            throw "REVIEW_FAILED: Could not read review JSON at $reviewPath. $_"
        }
        if ($review.verdict -notin @('pass', 'changes_requested', 'blocked') -or
            $review.browser_check_required -isnot [bool] -or $review.findings -isnot [array] -or
            ($review.verdict -eq 'pass' -and $review.findings.Count -ne 0) -or
            ($review.verdict -ne 'pass' -and $review.findings.Count -eq 0)) {
            throw 'REVIEW_FAILED: Invalid review result. Inspect the saved JSON.'
        }
        if ($review.verdict -eq 'blocked') {
            throw "REVIEW_BLOCKED: $($review.findings -join ' | ')"
        }
        if ($review.verdict -eq 'changes_requested') {
            $feedback = "Review findings:`n$($review.findings -join "`n")"
            continue
        }

        if ($BrowserCheck -or $plan.browser_check_required -or $review.browser_check_required) {
            Write-Host 'NEEDS_BROWSER_CHECK: Follow docs/MANUAL_TESTS.md and verify the task in a real browser.'
            exit 2
        }
        Write-Host 'DONE: npm run check and independent review passed.'
        return
    }
    throw "RETRY_LIMIT: Review the logs and working tree. Last failure:`n$feedback"
} catch {
    [Console]::Error.WriteLine("WORKFLOW_FAILED [$stage]: $($_.Exception.Message)")
    if ($stageLog) { [Console]::Error.WriteLine("Stage log: $stageLog") }
    exit 1
} finally {
    Pop-Location
}
