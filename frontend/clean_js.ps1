
$file = 'C:\Users\USUARIO\Documents\MIcrositio_INVIAS\frontend\admin-panel-functions.js'
$lines = Get-Content $file -Encoding UTF8

# Remove lines 350 to 444 (1-indexed), which are the orphaned old renderReportsTable body
$keep = @()
for ($i = 0; $i -lt $lines.Count; $i++) {
    # 1-indexed: keep lines NOT in range [350..444]
    if ($i -lt 349 -or $i -gt 443) {
        $keep += $lines[$i]
    }
}

Set-Content $file -Value $keep -Encoding UTF8
Write-Host "Done. Removed lines 350-444. Remaining: $($keep.Count) lines."
