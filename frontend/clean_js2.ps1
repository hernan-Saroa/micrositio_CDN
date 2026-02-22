
$file = 'C:\Users\USUARIO\Documents\MIcrositio_INVIAS\frontend\scripts\admin-panel.js'
$lines = Get-Content $file -Encoding UTF8

# Remove lines 471 to 623 (1-indexed)
# These are orphaned old report function bodies
$keep = @()
for ($i = 0; $i -lt $lines.Count; $i++) {
    if ($i -lt 470 -or $i -gt 622) {
        $keep += $lines[$i]
    }
}

Set-Content $file -Value $keep -Encoding UTF8
Write-Host "Done. Removed lines 471-623. Remaining: $($keep.Count) lines."
