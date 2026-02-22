
$file = 'admin-panel.html'
$lines = Get-Content $file -Encoding UTF8

# Remove lines 659 to 755 (0-indexed: 658 to 754)
$keep = @()
for ($i = 0; $i -lt $lines.Count; $i++) {
    # Lines are 1-indexed in the editor, array is 0-indexed
    # We want to keep lines NOT in range [659, 755] (1-indexed)
    if ($i -lt 658 -or $i -gt 754) {
        $keep += $lines[$i]
    }
}

Set-Content $file -Value $keep -Encoding UTF8
Write-Host "Done. Lines removed: 659-755 (original). New total: $($keep.Count)"
