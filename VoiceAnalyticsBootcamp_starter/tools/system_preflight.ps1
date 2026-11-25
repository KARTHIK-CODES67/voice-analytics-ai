# Reference educational preflight. Read-only: does not install software or reveal secrets.
Write-Host 'Windows / system:'
Get-CimInstance Win32_OperatingSystem | Select-Object Caption,Version,OSArchitecture
Get-CimInstance Win32_ComputerSystem | Select-Object Manufacturer,Model,TotalPhysicalMemory
Get-PSDrive C | Select-Object Name,Used,Free
Write-Host 'Interpreter / app checks:'
foreach ($cmd in @('py','git','ffmpeg','ffprobe','ollama','nvidia-smi')) {
  $found = Get-Command $cmd -ErrorAction SilentlyContinue
  Write-Host ("{0}: {1}" -f $cmd, $(if($found){$found.Source}else{'NOT FOUND'}))
}
Write-Host 'Do not share machine identifiers, device UUIDs or customer data in tickets.'
