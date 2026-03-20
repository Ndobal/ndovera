param(
    [Parameter(Position = 0)]
    [string]$Message
)

if ([string]::IsNullOrWhiteSpace($Message)) {
    $Message = "chore: snapshot $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')"
}

git add -A
if ($LASTEXITCODE -ne 0) {
    exit $LASTEXITCODE
}

git diff --cached --quiet
if ($LASTEXITCODE -eq 0) {
    Write-Host "No staged changes to commit. Trying push only..."
} else {
    git commit -m $Message
    if ($LASTEXITCODE -ne 0) {
        exit $LASTEXITCODE
    }
}

$branch = (git rev-parse --abbrev-ref HEAD).Trim()
if ([string]::IsNullOrWhiteSpace($branch) -or $branch -eq 'HEAD') {
    Write-Error "Cannot push because no branch is currently checked out."
    exit 1
}

git push origin $branch
exit $LASTEXITCODE